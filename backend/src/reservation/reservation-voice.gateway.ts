import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { ConstantsService } from '../common/constants/constants.service';
import { getClientIp, parseHotelId, buildReservationSession } from './reservation-session.helper';
import { LoggerService } from '../common/logger.service';
import { VoiceRealtimeService } from '../chat/voice-realtime.service';
import { MessagesService } from '../messages/messages.service';
import { ChatContextService } from '../chat-context/chat-context.service';
import { CostsService } from '../costs/costs.service';
import { CostType } from '../costs/costs.model';
import { AgentToolContext } from '../langgraph/langgraph-tools.context';
import { relayRealtimeEvent } from '../chat/gateway/realtime-relay.helper';

/**
 * The public reservation line, by voice.
 *
 * Runs on the concierge's Realtime pipeline rather than one of its own. OpenAI
 * Realtime does the listening, the turn-taking and the speaking; this gateway
 * only does what is particular to an anonymous public caller — finding the
 * property, resuming their session, and keeping one person from running up an
 * open-ended bill on a line that needs no login.
 *
 * The audio, the events and the persistence are the concierge's, through
 * VoiceRealtimeService and the shared relay. With no account on the context,
 * that pipeline gives the caller the reservation agent's prompt and tools.
 */
@WebSocketGateway({ cors: true, namespace: '/reservation-voice' })
@Injectable()
export class ReservationVoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly reservationService: ReservationService,
    private readonly constantsService: ConstantsService,
    private readonly logger: LoggerService,
    private readonly voiceRealtimeService: VoiceRealtimeService,
    private readonly messagesService: MessagesService,
    private readonly chatContextService: ChatContextService,
    private readonly costsService: CostsService,
  ) {}

  async handleConnection(client: any) {
    const strings = this.constantsService.public;
    const query: any = client.handshake?.query ?? {};
    // auth as well as query, as the text gateway does: a query is fixed when the
    // socket is built, before any chat exists, so only auth survives a reconnect.
    const auth: any = client.handshake?.auth ?? {};

    const hotelId = parseHotelId(query.hotelId ?? auth.hotelId);
    if (hotelId === null) {
      client.emit('error', { message: strings.ERROR_RESERVATION_HOTEL_REQUIRED });
      client.disconnect(true);
      return;
    }

    const ip = getClientIp(client);
    if (!this.reservationService.claimVoiceSession(ip)) {
      client.emit('error', { message: strings.ERROR_RESERVATION_VOICE_TOO_MANY_SESSIONS });
      client.disconnect(true);
      return;
    }
    client.voiceIp = ip;

    try {
      const handed = query.sessionToken ?? auth.sessionToken ?? null;
      const sessionToken = handed ? String(handed) : null;
      const result = await this.reservationService.startSession(hotelId, sessionToken);

      client.reservationContext = { hotelId, publicHotel: result.publicHotel };
      client.turnsUsed = 0;
      client.audioBytes = 0;
      if (result.chat) {
        client.session = buildReservationSession(client.reservationContext, result.chat.id, result.chat.languageCode ?? null);
      }

      const cfg = this.constantsService.private.RESERVATION_VOICE;
      // Hard stop on wall clock, when one is configured: an abandoned tab must
      // not hold a Realtime session open forever. Zero means no cap.
      if (cfg.MAX_SESSION_SECONDS > 0) {
        client.sessionTimer = setTimeout(() => {
          this.endCall(client, strings.ERROR_RESERVATION_VOICE_SESSION_EXPIRED);
        }, cfg.MAX_SESSION_SECONDS * 1000);
      }

      client.emit('ready', {
        chatId: result.chat ? result.chat.id : null,
        sessionToken: result.sessionToken,
        hotel: result.publicHotel,
        messages: result.messages,
      });
      client.emit('voice_ready');
    } catch (err: any) {
      const notFound = err?.status === 404 || err?.statusCode === 404;
      // Logged, because the caller only ever sees "we could not start the chat";
      // without this the reason for a dead line is recorded nowhere at all.
      if (!notFound) {
        this.logger.error({
          error: err,
          serviceName: 'ReservationVoiceGateway',
          actionName: 'handleConnection',
          traces: [{ stage: 'startSession' }],
        });
      }
      client.emit('error', {
        message: notFound ? strings.ERROR_RESERVATION_HOTEL_NOT_FOUND : strings.ERROR_RESERVATION_SETUP_FAILED,
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: any) {
    this.clearPlaybackWait(client);
    if (client.sessionTimer) {
      clearTimeout(client.sessionTimer);
      client.sessionTimer = null;
    }
    this.voiceRealtimeService.closeSession(client.id);
    if (client.voiceIp) {
      this.reservationService.releaseVoiceSession(client.voiceIp);
      client.voiceIp = null;
    }
    delete client.session;
    delete client.reservationContext;
  }

  private endCall(client: any, message: string): void {
    client.emit('error', { message });
    client.emit('voice_call_ended');
    client.disconnect(true);
  }

  /**
   * The chat is created when the caller first opens the line, not before, so a
   * visitor who only looks at the page never writes anything. Realtime needs a
   * chat to attach its turns to from the first word.
   */
  private async ensureChat(client: any): Promise<void> {
    if (client.session) {
      return;
    }
    const context = client.reservationContext;
    const created = await this.reservationService.createChat(context.hotelId);
    client.session = buildReservationSession(context, created.chat.id, created.chat.languageCode ?? null);
    client.emit('session', { chatId: created.chat.id, sessionToken: created.sessionToken });
  }

  /** No account: the shared pipeline reads that as "the public reservation agent". */
  private toolContext(client: any): AgentToolContext {
    return {
      account: null,
      hotelId: client.reservationContext.hotelId,
      bookingId: null,
      chatId: client.session.chatId,
      hotel: client.reservationContext.publicHotel,
      booking: null,
      languageCode: client.session.languageCode ?? null,
    };
  }

  @SubscribeMessage('voice_start')
  async onVoiceStart(client: any) {
    if (!client.reservationContext) {
      return;
    }
    // Already on the line. Re-announcing readiness here would loop with a client
    // that reopens its microphone on every voice_ready.
    if (this.voiceRealtimeService.hasSession(client.id)) {
      return;
    }
    try {
      await this.ensureChat(client);
      await this.voiceRealtimeService.createSession(client.id, this.toolContext(client), {
        onServerEvent: (event) => this.relay(client, event),
        onError: (error) => {
          this.logger.error({ error, serviceName: 'ReservationVoiceGateway', actionName: 'realtime' });
          client.emit('error', { message: this.constantsService.public.ERROR_RESERVATION_VOICE_FAILED });
        },
        onClose: () => client.emit('voice_closed'),
      });
      // The agent speaks first, the way someone picking up a phone does. Its own
      // instructions for this one response: left to the session prompt, the
      // opener came out as a request to choose a language, because nothing had
      // been said yet to detect one from. Queued by the service until the
      // session is configured, so it is never early.
      const cfg = this.constantsService.private.RESERVATION_VOICE;
      const hotelName = client.reservationContext?.publicHotel?.name ?? '';
      const greeting = cfg.GREETING.split(cfg.GREETING_HOTEL_TOKEN).join(hotelName).replace(/\[[^\]]*\]\s*/g, '').trim();
      this.voiceRealtimeService.sendClientEvent(client.id, {
        type: 'response.create',
        response: { instructions: `Open the call by saying, warmly and naturally, in English: "${greeting}" Say only that, then stop and listen.` },
      });
      this.armPlaybackWait(client);
    } catch (err: any) {
      this.logger.error({ error: err, serviceName: 'ReservationVoiceGateway', actionName: 'onVoiceStart' });
      client.emit('error', { message: this.constantsService.public.ERROR_RESERVATION_VOICE_FAILED });
    }
  }

  @SubscribeMessage('voice_client_chunk')
  onVoiceClientChunk(client: any, payload: { audio?: string }) {
    if (!client.reservationContext || !this.voiceRealtimeService.hasSession(client.id)) {
      return;
    }
    const audio = payload?.audio;
    if (typeof audio !== 'string' || audio.length === 0) {
      return;
    }

    const cfg = this.constantsService.private.RESERVATION_VOICE;
    // Metered on audio actually streamed rather than time connected — streamed
    // audio is what Realtime bills for, and nobody needs to log in to send it.
    client.audioBytes = (client.audioBytes ?? 0) + Buffer.byteLength(audio, 'base64');
    if (cfg.MAX_AUDIO_SECONDS_PER_SESSION > 0
        && client.audioBytes > cfg.MAX_AUDIO_SECONDS_PER_SESSION * cfg.AUDIO_BYTES_PER_SECOND) {
      this.endCall(client, this.constantsService.public.ERROR_RESERVATION_VOICE_TURN_LIMIT);
      return;
    }

    this.voiceRealtimeService.sendClientEvent(client.id, { type: 'input_audio_buffer.append', audio });
  }

  /**
   * The browser has finished playing one piece of audio.
   *
   * That is not the same as the turn being over. A turn that calls a tool is
   * two responses — speech and a tool call, then a follow-up — and the first
   * finishes playing before the second has even started. Handing the line back
   * at that point opened it in the gap: the caller's next sentence arrived
   * while a response was in flight, and the service drops anything said while
   * it is responding, so a whole answer went missing. So the line goes back
   * only when the final response is done and every piece of audio has played.
   */
  @SubscribeMessage('voice_playback_done')
  onPlaybackDone(client: any) {
    if (!this.voiceRealtimeService.hasSession(client.id)) {
      return;
    }
    client.awaitingPlayback = false;
    this.releaseIfDone(client);
  }

  private releaseIfDone(client: any): void {
    if (!client.turnComplete || client.awaitingPlayback) {
      return;
    }
    client.turnComplete = false;
    this.clearPlaybackWait(client);
    this.voiceRealtimeService.onPlaybackDone(client.id);
    client.emit('voice_ready');
  }

  @SubscribeMessage('voice_stop')
  onVoiceStop(client: any) {
    this.clearPlaybackWait(client);
    this.voiceRealtimeService.closeSession(client.id);
  }

  private relay(client: any, event: any): Promise<void> {
    const session = client.session;
    if (!session) {
      return Promise.resolve();
    }
    if (event.type === 'response.created') {
      client.turnComplete = false;
    } else if (event.type === 'response.output_audio.done') {
      // A flag, not a count: the browser restarts its playback watch on every
      // segment and reports once, when everything queued has played.
      client.awaitingPlayback = true;
    } else if (event.type === 'response.done' && !event._skipVoiceTextEnd) {
      // The service has already marked a tool-call round with _skipVoiceTextEnd,
      // so this is the response that actually ends the turn.
      client.turnComplete = true;
      this.releaseIfDone(client);
    }
    return relayRealtimeEvent(
      client,
      event,
      session.chatId,
      {
        voiceRealtimeService: this.voiceRealtimeService,
        messagesService: this.messagesService,
        chatContextService: this.chatContextService,
        logError: (message, err) => this.logger.error({ error: err, serviceName: 'ReservationVoiceGateway', actionName: message }),
      },
      {
        beforeTurn: () => {
          // A language the agent stored mid-call is on the realtime context; keep
          // the session in step so a reconnect resumes in the same language.
          const realtimeCtx = this.voiceRealtimeService.getContext(client.id);
          if (realtimeCtx) {
            session.languageCode = realtimeCtx.languageCode ?? session.languageCode ?? null;
          }
        },
        afterTurn: ({ cleanUser, cleanAssistant, usage, assistantMessage }) => {
          if (cleanAssistant) {
            this.costsService.recordLlmCost({
              type: CostType.LLM_VOICE,
              // Full usage, audio tokens included: the realtime pricing needs it.
              usage: usage ?? {},
              bookingId: null,
              hotelId: client.reservationContext?.hotelId ?? null,
              accountId: null,
              role: null,
              chatId: session.chatId,
              messageId: assistantMessage ? assistantMessage.id : null,
            });
          }
          // Only something the caller said counts as a turn — the greeting does not.
          if (cleanUser) {
            this.countTurn(client);
          }
        },
      },
    );
  }

  /** A public line nobody logs into still needs a ceiling on how long one caller can run it. */
  private countTurn(client: any): void {
    const strings = this.constantsService.public;
    const cfg = this.constantsService.private.RESERVATION_VOICE;
    client.turnsUsed = (client.turnsUsed ?? 0) + 1;
    if (cfg.MAX_TURNS_PER_SESSION > 0 && client.turnsUsed >= cfg.MAX_TURNS_PER_SESSION) {
      this.endCall(client, strings.ERROR_RESERVATION_VOICE_TURN_LIMIT);
      return;
    }
    if (!this.reservationService.isWithinVoiceTurnLimit(client.voiceIp)) {
      this.endCall(client, strings.ERROR_RESERVATION_VOICE_RATE_LIMITED);
    }
  }

  /**
   * Reopen the line if the browser never reports that the greeting finished — a
   * closed or backgrounded tab does not, and the caller must not be left unable
   * to speak because of it.
   */
  private armPlaybackWait(client: any): void {
    this.clearPlaybackWait(client);
    client.playbackWait = setTimeout(() => {
      client.playbackWait = null;
      client.emit('voice_ready');
    }, this.constantsService.private.RESERVATION_VOICE.PLAYBACK_DONE_TIMEOUT_MS);
  }

  private clearPlaybackWait(client: any): void {
    if (client.playbackWait) {
      clearTimeout(client.playbackWait);
      client.playbackWait = null;
    }
  }
}
