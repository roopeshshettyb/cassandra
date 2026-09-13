import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { ChatLlmService } from '../chat/chat-llm.service';
import { ChatSession } from '../chat/gateway/chat-session.interface';
import { ConstantsService } from '../common/constants/constants.service';
import { LoggerService } from '../common/logger.service';
import { CacheService } from '../common/cache/cache.service';
import { SttFactoryService } from '../stt/stt-factory.service';
import { TtsFactoryService } from '../tts/tts-factory.service';
import type { ISttSession } from '../stt/stt-session.interface';

interface TtsProvider {
  streamToClient: (client: any, text: string, options?: { emitEnd?: boolean; languageCode?: string | null }) => Promise<void>;
}

interface TurnState {
  sentenceBuffer: string;
  ttsQueue: Promise<void>;
}

/**
 * Delivery cues the prompt lets the model emit, e.g. "[warm] Sure, one moment."
 * ElevenLabs v3 consumes them as tone direction; every other provider would read
 * them out, and no caller should see them on screen either.
 */
const stripAudioTags = (text: string): string => text.replace(/\[[a-z][a-z ]{0,24}\]\s*/gi, '').trim();

/**
 * Public, unauthenticated voice reservation: the caller speaks, STT transcribes,
 * the accountless reservation agent answers, TTS speaks back.
 *
 * Always runs the STT -> LLM -> TTS pipeline regardless of VOICE_PIPELINE. The
 * speech-to-speech path is built around an authenticated session and gives no
 * per-turn seam to meter, and metering is the whole reason this can be public.
 */
@WebSocketGateway({ cors: true, namespace: '/reservation-voice' })
@Injectable()
export class ReservationVoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly reservationService: ReservationService,
    private readonly chatLlmService: ChatLlmService,
    private readonly constantsService: ConstantsService,
    private readonly logger: LoggerService,
    private readonly cacheService: CacheService,
    private readonly sttFactory: SttFactoryService,
    private readonly ttsFactory: TtsFactoryService,
  ) {}

  private getClientIp(client: any): string {
    const forwarded = client.handshake?.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    return client.handshake?.address ?? '';
  }

  /** Strict: a malformed id must be refused, never truncated to some hotel. */
  private parseHotelId(raw: unknown): number | null {
    if (typeof raw !== 'string' && typeof raw !== 'number') {
      return null;
    }
    const value = String(raw).trim();
    if (!/^[0-9]+$/.test(value)) {
      return null;
    }
    const hotelId = Number(value);
    return hotelId > 0 ? hotelId : null;
  }

  /** Speak each finished sentence as it lands so the caller hears a reply sooner. */
  /** Only ElevenLabs v3 understands the cues; everyone else gets them removed. */
  private ttsUnderstandsTags(): boolean {
    const rv = this.constantsService.private.RESERVATION_VOICE;
    const resolved = rv.TTS_PROVIDER && rv.TTS_PROVIDER.length > 0
      ? rv.TTS_PROVIDER
      : this.constantsService.private.LLM.TTS_CONFIG.PROVIDER;
    return resolved.toLowerCase() === 'elevenlabs';
  }

  private flushSentences(state: TurnState, client: any, provider: TtsProvider, languageCode: string | null): void {
    const regex = /([.!?])\s+/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    const parts: string[] = [];
    while ((match = regex.exec(state.sentenceBuffer)) !== null) {
      const sentence = state.sentenceBuffer.slice(lastIndex, match.index + 1).trim();
      if (sentence.length > 0) {
        parts.push(sentence);
      }
      lastIndex = regex.lastIndex;
    }
    if (parts.length === 0) {
      return;
    }
    state.sentenceBuffer = state.sentenceBuffer.slice(lastIndex);
    const keepTags = this.ttsUnderstandsTags();
    for (const sentence of parts) {
      const spoken = keepTags ? sentence : stripAudioTags(sentence);
      const shown = stripAudioTags(sentence);
      if (spoken.length > 0) {
        state.ttsQueue = state.ttsQueue.then(() => provider.streamToClient(client, spoken, { emitEnd: false, languageCode }));
      }
      if (shown.length > 0) {
        client.emit('voice_text_chunk', { delta: shown });
      }
    }
  }

  /**
   * PCM for one filler phrase, synthesised on first use and then replayed from
   * memory. Caching is the point: a filler that had to wait for a TTS round-trip
   * would add the very delay it exists to hide.
   *
   * The provider writes to a collector rather than the socket, which is how the
   * audio gets captured without changing the TTS interface.
   */
  private async getFillerChunks(phrase: string, languageCode: string | null, provider: TtsProvider): Promise<string[]> {
    const cfg = this.constantsService.private.RESERVATION_VOICE;
    const key = `${cfg.FILLER_CACHE_KEY_PREFIX}${languageCode ?? 'auto'}:${phrase}`;
    const cached = this.cacheService.get<string[]>(key);
    if (cached) {
      return cached;
    }

    const chunks: string[] = [];
    const collector = {
      emit: (event: string, payload?: any) => {
        if (event === 'voice_audio_chunk' && payload?.delta) {
          chunks.push(payload.delta);
        }
      },
    };
    await provider.streamToClient(collector, phrase, { emitEnd: false, languageCode });
    if (chunks.length > 0) {
      this.cacheService.set(key, chunks, cfg.FILLER_CACHE_MINUTES);
    }
    return chunks;
  }

  /** Fill the gap between the caller finishing and the answer beginning. */
  private async playThinkingFiller(client: any, provider: TtsProvider, languageCode: string | null): Promise<void> {
    const phrases = this.constantsService.private.RESERVATION_VOICE.THINKING_FILLERS;
    if (!phrases || phrases.length === 0) {
      return;
    }
    // Vary it, or the same noise every turn becomes its own tell.
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    const spoken = this.ttsUnderstandsTags() ? phrase : stripAudioTags(phrase);
    if (!spoken) {
      return;
    }
    try {
      const chunks = await this.getFillerChunks(spoken, languageCode, provider);
      for (const delta of chunks) {
        client.emit('voice_audio_chunk', { delta });
      }
    } catch (err: any) {
      // A filler is a nicety; never let it stop the real answer.
      this.logger.warn({
        message: err?.message ?? String(err),
        serviceName: 'ReservationVoiceGateway',
        actionName: 'playThinkingFiller',
      });
    }
  }

  private clearTurnFallback(client: any): void {
    if (client.turnFallback) {
      clearTimeout(client.turnFallback);
      client.turnFallback = null;
    }
  }

  /**
   * Deepgram occasionally does not emit UtteranceEnd — a dropped frame, a noisy
   * line — and the caller is then left speaking to a microphone that never
   * answers. Every chunk pushes this timer out; if audio simply stops and
   * nothing ended the turn, we end it ourselves with whatever was heard.
   */
  private armTurnFallback(client: any): void {
    const cfg = this.constantsService.private.RESERVATION_VOICE;
    this.clearTurnFallback(client);
    client.turnFallback = setTimeout(() => {
      const state = client.sttState;
      if (!client.sttSession || !state || state.done) {
        return;
      }
      if (state.finalParts.length === 0 && !state.interim) {
        return;
      }
      this.logger.warn({
        message: 'Forcing voice turn: no end-of-speech from STT',
        serviceName: 'ReservationVoiceGateway',
        actionName: 'armTurnFallback',
      });
      client.runTurn?.();
    }, cfg.UTTERANCE_END_MS + cfg.TURN_FALLBACK_GRACE_MS);
  }

  private endCall(client: any, message: string): void {
    client.emit('error', { message });
    client.emit('voice_call_ended');
    client.disconnect(true);
  }

  private destroySttSession(client: any): void {
    if (client.sttSession) {
      try {
        client.sttSession.destroy();
      } catch {
        // a session torn down mid-turn is expected on disconnect
      }
      client.sttSession = null;
    }
  }

  async handleConnection(client: any) {
    const strings = this.constantsService.public;
    const query: any = client.handshake?.query ?? {};

    const hotelId = this.parseHotelId(query.hotelId);
    if (hotelId === null) {
      client.emit('error', { message: strings.ERROR_RESERVATION_HOTEL_REQUIRED });
      client.disconnect(true);
      return;
    }

    const ip = this.getClientIp(client);
    if (!this.reservationService.claimVoiceSession(ip)) {
      client.emit('error', { message: strings.ERROR_RESERVATION_VOICE_TOO_MANY_SESSIONS });
      client.disconnect(true);
      return;
    }
    client.voiceIp = ip;

    try {
      const sessionToken = query.sessionToken ? String(query.sessionToken) : null;
      const result = await this.reservationService.startSession(hotelId, sessionToken);

      client.reservationContext = { hotelId, publicHotel: result.publicHotel };
      client.turnsUsed = 0;
      client.audioBytes = 0;
      if (result.chat) {
        client.session = this.buildSession(client.reservationContext, result.chat.id, result.chat.languageCode ?? null);
      }

      const cfg = this.constantsService.private.RESERVATION_VOICE;
      // Hard stop on wall clock, when one is configured: an abandoned tab must
      // not hold STT open forever. Zero means no cap.
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
      client.emit('error', {
        message: notFound ? strings.ERROR_RESERVATION_HOTEL_NOT_FOUND : strings.ERROR_RESERVATION_SETUP_FAILED,
      });
      client.disconnect(true);
    }
  }

  private buildSession(context: any, chatId: number, languageCode: string | null): ChatSession {
    return {
      account: null,
      bookingId: null,
      hotelId: context.hotelId,
      chatId,
      hotel: context.publicHotel,
      booking: null,
      languageCode,
    };
  }

  private createSttSession(client: any): ISttSession | null {
    this.destroySttSession(client);
    try {
      const cfg = this.constantsService.private.RESERVATION_VOICE;
      // Own provider and own turn-taking: tuning the public call must never
      // move the signed-in concierge.
      const sttSession = this.sttFactory
        .getFactory(cfg.STT_PROVIDER)
        .createSession({ utteranceEndMs: cfg.UTTERANCE_END_MS });
      client.sttSession = sttSession;
      // Deepgram finalises in several pieces within one utterance — "hello" can
      // land as final before the rest of the sentence does. Keeping only the
      // most recent final would throw away everything the caller said before
      // the last pause, so the pieces are collected and joined.
      const state = { finalParts: [] as string[], interim: '', done: false };
      client.sttState = state;

      const runTurn = () => {
        if (state.done) {
          return;
        }
        state.done = true;
        this.clearTurnFallback(client);
        try {
          sttSession.endInput();
        } catch {
          // already closed
        }
        if (client.sttSession === sttSession) {
          client.sttSession = null;
        }
        sttSession.destroy();
        client.emit('voice_turn_end');
        // Interim text is the fallback: better to answer what we heard than to
        // leave the caller talking to silence.
        const heard = state.finalParts.length > 0 ? state.finalParts.join(' ') : state.interim;
        void this.handleTurn(client, heard);
      };
      client.runTurn = runTurn;

      sttSession.onTranscript((text: string, isFinal?: boolean) => {
        const trimmed = text.trim();
        if (isFinal && trimmed.length > 0) {
          state.finalParts.push(trimmed);
        } else if (trimmed.length > 0) {
          state.interim = trimmed;
        }
        client.emit('voice_user_chunk', { delta: text, isFinal: !!isFinal });
      });

      sttSession.onEndOfSpeech(runTurn);

      return sttSession;
    } catch (err: any) {
      this.logger.warn({
        message: err?.message ?? String(err),
        serviceName: 'ReservationVoiceGateway',
        actionName: 'createSttSession',
      });
      client.emit('error', { message: this.constantsService.public.ERROR_RESERVATION_VOICE_FAILED });
      return null;
    }
  }

  /** One spoken turn: transcript in, budgets checked, spoken answer out. */
  private async handleTurn(client: any, transcript: string): Promise<void> {
    const strings = this.constantsService.public;
    const cfg = this.constantsService.private.RESERVATION_VOICE;
    const context = client.reservationContext;

    const text = typeof transcript === 'string' ? transcript.trim() : '';
    if (!context || !text) {
      client.emit('voice_ready');
      return;
    }

    if (cfg.MAX_TURNS_PER_SESSION > 0 && (client.turnsUsed ?? 0) >= cfg.MAX_TURNS_PER_SESSION) {
      this.endCall(client, strings.ERROR_RESERVATION_VOICE_TURN_LIMIT);
      return;
    }
    if (!this.reservationService.isWithinVoiceTurnLimit(client.voiceIp)) {
      this.endCall(client, strings.ERROR_RESERVATION_VOICE_RATE_LIMITED);
      return;
    }
    client.turnsUsed = (client.turnsUsed ?? 0) + 1;

    client.voiceBusy = true;
    client.emit('voice_user_message', { text });

    try {
      // The chat row is created on the first thing actually said, so a visitor
      // who opens the page and stays silent never writes anything.
      if (!client.session) {
        const created = await this.reservationService.createChat(context.hotelId);
        client.session = this.buildSession(context, created.chat.id, created.chat.languageCode ?? null);
        client.emit('session', { chatId: created.chat.id, sessionToken: created.sessionToken });
      }

      const session: ChatSession = client.session;
      const provider = this.ttsFactory.getProvider(
        this.constantsService.private.RESERVATION_VOICE.TTS_PROVIDER,
      ) as TtsProvider;
      const languageCode = session.languageCode ?? null;
      const state: TurnState = { sentenceBuffer: '', ttsQueue: Promise.resolve() };

      // Speak a thinking noise now, while the model is still working. The client
      // queues audio in order, so this plays first and the answer follows on.
      state.ttsQueue = this.playThinkingFiller(client, provider, languageCode);

      await this.chatLlmService.streamUserMessage(session, text, {
        mode: 'voice',
        onChunk: (chunk: string) => {
          if (!chunk) return;
          state.sentenceBuffer += chunk;
          this.flushSentences(state, client, provider, languageCode);
        },
        onEnd: async (result) => {
          const tail = state.sentenceBuffer.trim();
          const spokenTail = this.ttsUnderstandsTags() ? tail : stripAudioTags(tail);
          if (spokenTail.length > 0) {
            await state.ttsQueue;
            await provider.streamToClient(client, spokenTail, { emitEnd: true, languageCode });
          } else {
            await state.ttsQueue;
            client.emit('voice_audio_end');
          }
          client.emit('voice_text_end', { text: stripAudioTags(result.fullContent) });
        },
      });
    } catch (err: any) {
      this.logger.warn({
        message: err?.message ?? String(err),
        serviceName: 'ReservationVoiceGateway',
        actionName: 'handleTurn',
      });
      client.emit('error', { message: strings.ERROR_RESERVATION_VOICE_FAILED });
      client.emit('voice_audio_end');
    } finally {
      client.voiceBusy = false;
      client.emit('voice_ready');
    }
  }

  @SubscribeMessage('voice_client_chunk')
  onVoiceClientChunk(client: any, payload: { audio?: string }) {
    if (!client.reservationContext || client.voiceBusy) {
      return;
    }
    const audio = payload?.audio;
    if (typeof audio !== 'string' || audio.length === 0) {
      return;
    }

    const cfg = this.constantsService.private.RESERVATION_VOICE;
    const buffer = Buffer.from(audio, 'base64');

    // Metered on audio actually streamed rather than time connected — streamed
    // audio is what STT bills for.
    client.audioBytes = (client.audioBytes ?? 0) + buffer.length;
    if (cfg.MAX_AUDIO_SECONDS_PER_SESSION > 0
        && client.audioBytes > cfg.MAX_AUDIO_SECONDS_PER_SESSION * cfg.AUDIO_BYTES_PER_SECOND) {
      this.endCall(client, this.constantsService.public.ERROR_RESERVATION_VOICE_TURN_LIMIT);
      return;
    }

    let sttSession: ISttSession | undefined = client.sttSession;
    if (!sttSession) {
      sttSession = this.createSttSession(client) ?? undefined;
      if (!sttSession) return;
    }
    sttSession.writeAudio(buffer);
    this.armTurnFallback(client);
  }

  /**
   * Sent when the caller taps the mic, before any audio. Opening the STT socket
   * here rather than on the first chunk gives it the getUserMedia window to
   * connect — otherwise the caller's opening words arrive before the socket is
   * ready and are dropped. Costs nothing for a visitor who never speaks.
   */
  @SubscribeMessage('voice_start')
  onVoiceStart(client: any) {
    if (!client.reservationContext || client.voiceBusy || client.sttSession) {
      return;
    }
    this.createSttSession(client);
  }

  @SubscribeMessage('voice_stop')
  onVoiceStop(client: any) {
    this.clearTurnFallback(client);
    this.destroySttSession(client);
    client.emit('voice_ready');
  }

  handleDisconnect(client: any) {
    this.clearTurnFallback(client);
    if (client.sessionTimer) {
      clearTimeout(client.sessionTimer);
      client.sessionTimer = null;
    }
    this.destroySttSession(client);
    if (client.voiceIp) {
      this.reservationService.releaseVoiceSession(client.voiceIp);
      client.voiceIp = null;
    }
    delete client.session;
    delete client.reservationContext;
  }
}
