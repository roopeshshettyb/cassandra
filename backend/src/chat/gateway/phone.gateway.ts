import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { WebSocketServer, WebSocket } from 'ws';
import { Op } from 'sequelize';
import { AccountRole } from '../../accounts/accounts.model';
import { AccountsService } from '../../accounts/accounts.service';
import { BookingsService } from '../../bookings/bookings.service';
import { ChatService } from '../chat.service';
import { ConstantsService } from '../../common/constants/constants.service';
import { VoiceRealtimeService } from '../voice-realtime.service';
import { DeepgramVoiceAgentService } from '../deepgram-voice-agent.service';
import { VoiceGateway } from './voice.gateway';
import { ChatSession } from './chat-session.interface';

interface PhoneCallState {
  ws: WebSocket;
  streamSid: string | null;
  callSid: string | null;
  session: ChatSession | null;
  shim: any;
  outBuffer: Buffer;
  turnAudioBytes: number;
  playbackTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Bridges Exotel Voicebot-applet calls (raw WebSocket, base64 slin frames) into the
 * same voice pipelines the web/mobile socket.io clients use. Caller identity comes
 * from the caller ID (accounts.phone) instead of a JWT; unknown callers are dropped,
 * which makes Exotel advance to the next applet in the call flow (e.g. front desk).
 */
@Injectable()
export class PhoneGateway implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(PhoneGateway.name);
  private wss: WebSocketServer | null = null;

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly accountsService: AccountsService,
    private readonly bookingsService: BookingsService,
    private readonly chatService: ChatService,
    private readonly constantsService: ConstantsService,
    private readonly voiceRealtimeService: VoiceRealtimeService,
    private readonly deepgramVoiceAgentService: DeepgramVoiceAgentService,
    private readonly voiceGateway: VoiceGateway,
  ) {}

  private get phoneConfig() {
    return this.constantsService.private.LLM.PHONE;
  }

  private isGpt(): boolean {
    return this.constantsService.private.LLM.VOICE_PIPELINE === 'gpt';
  }

  private isDeepgram(): boolean {
    return this.constantsService.private.LLM.VOICE_PIPELINE === 'deepgram';
  }

  onApplicationBootstrap() {
    const config = this.phoneConfig;
    if (!config.WS_SECRET) {
      this.logger.log('PHONE_WS_SECRET not set — phone voice bridge disabled');
      return;
    }
    if (!this.isGpt() && !this.isDeepgram()) {
      this.logger.warn(config.ERROR_PIPELINE_UNSUPPORTED);
      return;
    }
    const server = this.httpAdapterHost.httpAdapter?.getHttpServer?.();
    if (!server) {
      this.logger.warn('HTTP server unavailable — phone voice bridge disabled');
      return;
    }
    // Diagnostic-only, path-agnostic: the `ws` path option below silently drops any
    // upgrade whose pathname doesn't match — this passive listener logs every upgrade
    // attempt regardless, so a path/casing mismatch from the caller (e.g. Exotel) is
    // visible instead of vanishing with zero trace.
    server.on('upgrade', (req: any) => {
      this.logger.log(`Upgrade request received: ${req?.url} remoteAddr=${req?.socket?.remoteAddress}`);
    });
    // ws matches on pathname only, so the applet URL may carry query params (?token=…&sample-rate=…).
    this.wss = new WebSocketServer({ server, path: config.WS_PATH });
    this.wss.on('connection', (ws: WebSocket, req: any) => this.onConnection(ws, req));
    this.logger.log(`Phone voice bridge listening on ${config.WS_PATH}`);
  }

  onApplicationShutdown() {
    this.wss?.close();
  }

  private onConnection(ws: WebSocket, req: any) {
    const config = this.phoneConfig;
    const url = req?.url ?? '';
    const token = new URL(url, 'http://localhost').searchParams.get('token');
    if (token !== config.WS_SECRET) {
      // Diagnostic-only: lengths/prefixes, never the full secret, so a mismatch (bad
      // URL-encoding, truncation, stale copy-paste) is visible without leaking WS_SECRET.
      this.logger.warn(
        `Rejected phone connection: token mismatch. path=${url.split('?')[0]} received="${(token ?? '').slice(0, 6)}…" (len ${token?.length ?? 0}) expected len ${config.WS_SECRET?.length ?? 0} remoteAddr=${req?.socket?.remoteAddress}`,
      );
      ws.close(1008);
      return;
    }
    this.logger.log(`Phone WebSocket connected: remoteAddr=${req?.socket?.remoteAddress}`);

    const state: PhoneCallState = {
      ws,
      streamSid: null,
      callSid: null,
      session: null,
      shim: null,
      outBuffer: Buffer.alloc(0),
      turnAudioBytes: 0,
      playbackTimer: null,
    };

    ws.on('message', (data: any) => {
      let frame: any;
      try {
        frame = JSON.parse(data.toString());
      } catch {
        return;
      }
      this.onFrame(state, frame).catch((err: any) => {
        this.logger.error(`Phone frame handling failed: ${err?.message ?? err}`);
      });
    });
    ws.on('close', () => this.endCall(state));
    ws.on('error', (err: any) => {
      this.logger.warn(`Phone WebSocket error: ${err?.message ?? err}`);
      this.endCall(state);
    });
  }

  private async onFrame(state: PhoneCallState, frame: any) {
    switch (frame?.event) {
      case 'start':
        await this.onStart(state, frame);
        break;
      case 'media': {
        const payload = frame?.media?.payload;
        if (!payload || !state.callSid || !state.session) return;
        if (this.isGpt()) {
          this.voiceRealtimeService.sendClientEvent(state.callSid, { type: 'input_audio_buffer.append', audio: payload });
        } else {
          this.deepgramVoiceAgentService.sendAudio(state.callSid, Buffer.from(payload, 'base64'));
        }
        break;
      }
      case 'stop':
        this.endCall(state);
        break;
      default:
        break; // connected / dtmf / mark — not needed v1
    }
  }

  private async onStart(state: PhoneCallState, frame: any) {
    const config = this.phoneConfig;
    const start: any = frame?.start ?? {};
    state.streamSid = frame?.stream_sid ?? start.stream_sid ?? null;
    state.callSid = start.call_sid || state.streamSid;

    const account = await this.findAccountByPhone(start.from);
    if (!account || !state.callSid) {
      this.logger.log(`${config.ERROR_UNKNOWN_CALLER}: ${start.from ?? 'no caller id'}`);
      state.ws.close(); // Exotel falls through to the next applet in the flow
      return;
    }

    let bookingId: number | null = null;
    let booking: any = null;
    let hotel: any = null;
    let chat: any;
    if (account.role === AccountRole.GUEST) {
      const active = await this.bookingsService.findActiveForGuest(account);
      if (active.data) {
        // Re-fetch with hotel include + ownership check, same shape authenticateAndInit builds.
        const full = await this.bookingsService.findByIdForAccount(active.data.id, account);
        booking = full?.data ?? null;
        bookingId = booking ? booking.id : null;
        hotel = booking?.hotel ?? null;
      }
    }
    chat = bookingId
      ? await this.chatService.findOrCreateForBooking(bookingId, account)
      : await this.chatService.findOrCreateGeneralForAccount(account);

    const session: ChatSession = { account, bookingId, chatId: chat.id, hotel, booking, languageCode: chat.languageCode ?? null };
    state.session = session;
    state.shim = {
      id: state.callSid,
      session,
      emit: (event: string, payload?: any) => this.onPipelineEmit(state, event, payload),
    };

    const toolContext = { account, bookingId, chatId: chat.id, hotel, booking, languageCode: session.languageCode ?? null };
    const handlers = {
      onError: (error: Error) => this.logger.error(`Phone voice session error: ${error.message}`),
      onClose: () => this.endCall(state),
    };

    if (this.isGpt()) {
      await this.voiceRealtimeService.createSession(state.callSid, toolContext, {
        ...handlers,
        onServerEvent: (event: any) => {
          this.watchRealtimeEvent(state, event);
          this.voiceGateway.handleRealtimeEvent(state.shim, event);
        },
      });
      const greeting = config.GREETING_INSTRUCTIONS.replace('{APP_NAME}', this.constantsService.public.APP_NAME);
      this.voiceRealtimeService.sendClientEvent(state.callSid, { type: 'response.create', response: { instructions: greeting } });
    } else {
      await this.deepgramVoiceAgentService.createSession(state.callSid, toolContext, {
        ...handlers,
        onServerEvent: (event: any) => {
          this.watchDeepgramEvent(state, event);
          this.voiceGateway.handleDeepgramEvent(state.shim, event);
        },
      });
    }
    this.logger.log(`Phone call started: ${state.callSid} → account ${account.id} (${account.role})${bookingId ? `, booking ${bookingId}` : ''}`);
  }

  private async findAccountByPhone(from: string | undefined) {
    const digits = String(from ?? '').replace(/\D/g, '');
    const tail = digits.slice(-this.phoneConfig.CALLER_MATCH_DIGITS);
    if (!tail) return null;
    return this.accountsService.findOne({ where: { phone: { [Op.like]: `%${tail}` } } });
  }

  /** Translate the internal socket.io-shaped emits from VoiceGateway handlers into Exotel frames. */
  private onPipelineEmit(state: PhoneCallState, event: string, payload?: any) {
    switch (event) {
      case 'voice_audio_chunk': {
        if (!payload?.delta) return;
        state.outBuffer = Buffer.concat([state.outBuffer, Buffer.from(payload.delta, 'base64')]);
        this.flushOutbound(state, false);
        break;
      }
      case 'voice_audio_end':
        this.flushOutbound(state, true);
        if (this.isGpt()) this.schedulePlaybackDone(state);
        break;
      case 'voice_closed':
        this.endCall(state);
        break;
      case 'error':
        this.logger.warn(`Phone pipeline error: ${payload?.message ?? 'unknown'}`);
        break;
      default:
        break; // text/transcript events have no phone-side surface
    }
  }

  private flushOutbound(state: PhoneCallState, final: boolean) {
    const config = this.phoneConfig;
    while (state.outBuffer.length >= config.OUTBOUND_CHUNK_BYTES) {
      this.sendMedia(state, state.outBuffer.subarray(0, config.OUTBOUND_CHUNK_BYTES));
      state.outBuffer = state.outBuffer.subarray(config.OUTBOUND_CHUNK_BYTES);
    }
    if (final && state.outBuffer.length > 0) {
      // Pad the tail with silence up to the required 320-byte multiple.
      const padded = Math.ceil(state.outBuffer.length / config.OUTBOUND_CHUNK_MULTIPLE) * config.OUTBOUND_CHUNK_MULTIPLE;
      this.sendMedia(state, Buffer.concat([state.outBuffer, Buffer.alloc(padded - state.outBuffer.length)]));
      state.outBuffer = Buffer.alloc(0);
    }
  }

  private sendMedia(state: PhoneCallState, chunk: Buffer) {
    if (state.ws.readyState !== WebSocket.OPEN || !state.streamSid) return;
    state.turnAudioBytes += chunk.length;
    state.ws.send(JSON.stringify({ event: 'media', stream_sid: state.streamSid, media: { payload: chunk.toString('base64') } }));
  }

  private sendClear(state: PhoneCallState) {
    state.outBuffer = Buffer.alloc(0);
    if (state.ws.readyState !== WebSocket.OPEN || !state.streamSid) return;
    state.ws.send(JSON.stringify({ event: 'clear', stream_sid: state.streamSid }));
  }

  /**
   * The phone cannot report playback completion (unlike web/mobile clients), so the
   * GPT pipeline's mic gate is re-opened after the estimated playout of the audio
   * we handed to Exotel, plus a grace period.
   */
  private schedulePlaybackDone(state: PhoneCallState) {
    const config = this.phoneConfig;
    const playoutMs = (state.turnAudioBytes / (config.SAMPLE_RATE * 2)) * 1000;
    state.turnAudioBytes = 0;
    if (state.playbackTimer) clearTimeout(state.playbackTimer);
    state.playbackTimer = setTimeout(() => {
      state.playbackTimer = null;
      if (state.callSid) this.voiceRealtimeService.onPlaybackDone(state.callSid);
    }, playoutMs + config.PLAYBACK_DONE_GRACE_MS);
  }

  private watchRealtimeEvent(state: PhoneCallState, event: any) {
    if (event?.type === 'response.created') {
      state.turnAudioBytes = 0;
    } else if (event?.type === 'input_audio_buffer.speech_started') {
      this.sendClear(state); // barge-in: drop any Exotel-buffered assistant audio
    }
  }

  private watchDeepgramEvent(state: PhoneCallState, event: any) {
    if (event?.type === 'UserStartedSpeaking') {
      this.sendClear(state); // Deepgram agent handles interruption; flush stale audio on our side
    }
  }

  private endCall(state: PhoneCallState) {
    if (state.playbackTimer) {
      clearTimeout(state.playbackTimer);
      state.playbackTimer = null;
    }
    if (state.callSid) {
      if (this.isGpt()) this.voiceRealtimeService.closeSession(state.callSid);
      else if (this.isDeepgram()) this.deepgramVoiceAgentService.closeSession(state.callSid);
      state.callSid = null;
    }
    if (state.ws.readyState === WebSocket.OPEN) state.ws.close();
  }
}
