import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { ChatLlmService } from '../chat/chat-llm.service';
import { ChatSession } from '../chat/gateway/chat-session.interface';
import { ConstantsService } from '../common/constants/constants.service';
import { getClientIp, parseHotelId, buildReservationSession, buildSttKeyterms } from './reservation-session.helper';
import { splitSentences, stripAudioTags } from '../common/sentence.util';
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
export class ReservationVoiceGateway implements OnModuleInit, OnGatewayConnection, OnGatewayDisconnect {
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
    const llm = this.constantsService.private.LLM;
    const { parts, rest } = splitSentences(
      state.sentenceBuffer,
      llm.SENTENCE_TERMINATORS_LATIN,
      llm.SENTENCE_TERMINATORS_OTHER,
    );
    if (parts.length === 0) {
      return;
    }
    state.sentenceBuffer = rest;
    const keepTags = this.ttsUnderstandsTags();
    for (const sentence of parts) {
      const spoken = keepTags ? sentence : stripAudioTags(sentence);
      const shown = stripAudioTags(sentence);
      if (spoken.length > 0) {
        // Caught per sentence on purpose. The queue is one promise chain, so a
        // single rejected request would poison every .then() after it and the
        // caller would hear the reply stop mid-thought with no error anywhere.
        // One bad fragment should cost that fragment, not the rest of the answer.
        state.ttsQueue = state.ttsQueue
          .then(() => provider.streamToClient(client, spoken, { emitEnd: false, languageCode }))
          .catch((err: any) => {
            this.logger.warn({
              message: err?.message ?? String(err),
              serviceName: 'ReservationVoiceGateway',
              actionName: 'flushSentences',
              traces: [{ stage: 'tts' }],
            });
          });
      }
      if (shown.length > 0) {
        client.emit('voice_text_chunk', { delta: shown });
      }
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
    // auth as well as query, the way the text gateway already reads it. The query
    // string is fixed when the socket is constructed, so a reconnect can only
    // carry the token it had at mount — which is none, because the chat does not
    // exist until the first turn. auth is re-read on every attempt, so this is
    // what lets a recovered call resume its conversation instead of starting over.
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


  private createSttSession(client: any): ISttSession | null {
    this.destroySttSession(client);
    try {
      const cfg = this.constantsService.private.RESERVATION_VOICE;
      // Own provider and own turn-taking: tuning the public call must never
      // move the signed-in concierge.
      const sttSession = this.sttFactory
        .getFactory(cfg.STT_PROVIDER)
        .createSession({
          utteranceEndMs: cfg.UTTERANCE_END_MS,
          language: cfg.STT_LANGUAGE,
          keyterms: buildSttKeyterms(client.reservationContext ?? {}, cfg.STT_KEYTERMS),
        });
      client.sttSession = sttSession;
      // Deepgram finalises in several pieces within one utterance — "hello" can
      // land as final before the rest of the sentence does. Keeping only the
      // most recent final would throw away everything the caller said before
      // the last pause, so the pieces are collected and joined.
      const state = {
        finalParts: [] as string[],
        interim: '',
        done: false,
        /** Set once speech has ended and the corrected transcript is still owed. */
        awaitingFinal: null as ReturnType<typeof setTimeout> | null,
      };
      client.sttState = state;

      const runTurn = () => {
        if (state.done) {
          return;
        }
        state.done = true;
        if (state.awaitingFinal) {
          clearTimeout(state.awaitingFinal);
          state.awaitingFinal = null;
        }
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
        // The corrected transcript we were waiting for. Answer it, not the
        // half-sentence that preceded it.
        if (isFinal && state.awaitingFinal) {
          runTurn();
        }
      });

      /**
       * End of speech is not end of transcript.
       *
       * Sarvam signals the silence first and sends the corrected text after it,
       * so running the turn on the signal destroyed the session before the real
       * transcript arrived and the agent answered the last partial instead. A
       * caller reading out a phone number was heard as "my number is".
       *
       * So the turn waits for the final, and the timer is only there for a
       * provider that never sends one — a caller must not be left talking to
       * silence because a transcript went missing.
       */
      sttSession.onEndOfSpeech(() => {
        if (state.done || state.awaitingFinal) {
          return;
        }
        state.awaitingFinal = setTimeout(runTurn, cfg.FINAL_TRANSCRIPT_GRACE_MS);
      });

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

  /**
   * Synthesise every filler once at boot, so no caller is the one who warms it.
   *
   * Warming a phrase on demand does not work: with two dozen of them picked at
   * random, a call has to be unlucky to reuse one, so measured across eight
   * calls only the last was fast and the mean came out worse than having no
   * filler at all. Every deploy empties the cache, so the alternative is most
   * callers hearing nothing.
   *
   * In the background and never awaited — a TTS outage must not stop the
   * gateway coming up, and the fillers are the first thing to go without.
   */
  onModuleInit(): void {
    const cfg = this.constantsService.private.RESERVATION_VOICE;
    const phrases = cfg.THINKING_FILLERS ?? [];
    if (phrases.length === 0) {
      return;
    }
    void (async () => {
      try {
        const provider = this.ttsFactory.getProvider(cfg.TTS_PROVIDER) as TtsProvider;
        const keepTags = this.ttsUnderstandsTags();
        for (const phrase of phrases) {
          const spoken = keepTags ? phrase : stripAudioTags(phrase);
          if (spoken) {
            // One at a time: this is warming a cache, not racing anybody.
            await this.getFillerChunks(spoken, null, provider);
          }
        }
      } catch (err: any) {
        this.logger.warn({
          message: err?.message ?? String(err),
          serviceName: 'ReservationVoiceGateway',
          actionName: 'warmFillers',
        });
      }
    })();
  }

  /**
   * PCM for one filler phrase, synthesised on first use and then replayed from
   * memory. Caching is the point: a filler that had to wait for a TTS round
   * trip would add the very delay it exists to hide.
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

  /**
   * Fill the gap between the caller finishing and the answer beginning.
   *
   * Never the same one twice running: picking at random from a long list still
   * repeats, and a repeat back-to-back is more noticeable than any single
   * phrase, because it is the one thing a person would never do.
   */
  private async playThinkingFiller(client: any, provider: TtsProvider, languageCode: string | null): Promise<void> {
    const phrases = this.constantsService.private.RESERVATION_VOICE.THINKING_FILLERS;
    if (!phrases || phrases.length === 0) {
      return;
    }
    let index = Math.floor(Math.random() * phrases.length);
    if (phrases.length > 1 && index === client.lastFiller) {
      index = (index + 1) % phrases.length;
    }
    client.lastFiller = index;

    const spoken = this.ttsUnderstandsTags() ? phrases[index] : stripAudioTags(phrases[index]);
    if (!spoken) {
      return;
    }
    // Only ever play one that is already in memory. A phrase being used for the
    // first time has to be synthesised, and the answer queues behind whatever
    // this returns — measured, that turned a 2.8s wait into a 6.0s one, which is
    // the exact opposite of the job. So a cold phrase is synthesised in the
    // background for next time and this turn simply goes without.
    const cfg = this.constantsService.private.RESERVATION_VOICE;
    const key = `${cfg.FILLER_CACHE_KEY_PREFIX}${languageCode ?? 'auto'}:${spoken}`;
    if (!this.cacheService.get<string[]>(key)) {
      void this.getFillerChunks(spoken, languageCode, provider).catch(() => {});
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
        client.session = buildReservationSession(context, created.chat.id, created.chat.languageCode ?? null);
        client.emit('session', { chatId: created.chat.id, sessionToken: created.sessionToken });
      }

      const session: ChatSession = client.session;
      const provider = this.ttsFactory.getProvider(
        this.constantsService.private.RESERVATION_VOICE.TTS_PROVIDER,
      ) as TtsProvider;
      const languageCode = session.languageCode ?? null;
      // Speak a thinking noise now, while the model is still working. The client
      // queues audio in order, so this plays first and the answer follows on.
      // It goes out on every turn: these say only "I heard you", which is always
      // true, so there is no judgement call about whether one is warranted.
      const state: TurnState = { sentenceBuffer: '', ttsQueue: this.playThinkingFiller(client, provider, languageCode) };

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
      // The turn ends when the caller has heard the reply, not when the last
      // audio left here — chunks are scheduled ahead, so only the browser
      // knows. It reports back, exactly as the concierge's client does.
      this.armPlaybackWait(client);
    }
  }

  /**
   * Hold the turn until the browser says the reply has finished playing.
   *
   * The timer is the safety net: a tab that is closed, backgrounded or
   * disconnected never reports, and the line must not stay busy for the rest of
   * the session because of it.
   */
  private armPlaybackWait(client: any): void {
    this.clearPlaybackWait(client);
    client.playbackWait = setTimeout(
      () => this.releaseTurn(client),
      this.constantsService.private.RESERVATION_VOICE.PLAYBACK_DONE_TIMEOUT_MS,
    );
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
    // The line opens with the agent speaking, not with silence the caller has to
    // say "hello?" into. It runs as turn zero through the same handshake a reply
    // uses — busy while it plays, so the open microphone cannot hear it, and the
    // browser reports when it has finished, which reopens the mic. Greeting on
    // connect instead would be too early: the page only gets permission to make
    // sound inside the tap.
    if (!client.greeted) {
      client.greeted = true;
      void this.playGreeting(client);
      return;
    }
    this.createSttSession(client);
  }

  /** The agent's opening line, spoken before the caller has said anything. */
  private async playGreeting(client: any): Promise<void> {
    const cfg = this.constantsService.private.RESERVATION_VOICE;
    const hotel = client.reservationContext?.publicHotel;
    const name = hotel && typeof hotel.name === 'string' ? hotel.name : '';
    const phrase = (cfg.GREETING ?? '').split(cfg.GREETING_HOTEL_TOKEN).join(name).replace(/\s+/g, ' ').trim();
    if (!phrase) {
      this.createSttSession(client);
      return;
    }

    client.voiceBusy = true;
    try {
      const provider = this.ttsFactory.getProvider(cfg.TTS_PROVIDER) as TtsProvider;
      const spoken = this.ttsUnderstandsTags() ? phrase : stripAudioTags(phrase);
      // Cached per property, so only the first caller at a property waits for it.
      const chunks = await this.getFillerChunks(spoken, null, provider);
      for (const delta of chunks) {
        client.emit('voice_audio_chunk', { delta });
      }
      client.emit('voice_audio_end');
      client.emit('voice_text_end', { text: stripAudioTags(phrase) });
      this.armPlaybackWait(client);
    } catch (err: any) {
      // Never let the opening line cost the caller the call.
      this.logger.warn({
        message: err?.message ?? String(err),
        serviceName: 'ReservationVoiceGateway',
        actionName: 'playGreeting',
      });
      this.releaseTurn(client);
    }
  }

  /** Cancel the safety net that would otherwise release the turn on its own. */
  private clearPlaybackWait(client: any): void {
    if (client.playbackWait) {
      clearTimeout(client.playbackWait);
      client.playbackWait = null;
    }
  }

  /** Hand the line back to the caller, once. */
  private releaseTurn(client: any): void {
    this.clearPlaybackWait(client);
    if (!client.voiceBusy) {
      return;
    }
    client.voiceBusy = false;
    client.emit('voice_ready');
  }

  /**
   * The browser has finished playing the reply. Same message the concierge
   * sends, for the same reason: only the client can see when the sound stopped.
   */
  @SubscribeMessage('voice_playback_done')
  onPlaybackDone(client: any) {
    this.releaseTurn(client);
  }

  @SubscribeMessage('voice_stop')
  onVoiceStop(client: any) {
    this.clearTurnFallback(client);
    this.destroySttSession(client);
    client.emit('voice_ready');
  }

  handleDisconnect(client: any) {
    this.clearPlaybackWait(client);
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
