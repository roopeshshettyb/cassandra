import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { ChatLlmService } from '../chat/chat-llm.service';
import { ConstantsService } from '../common/constants/constants.service';
import { splitSentences, stripAudioTags, stripToolEcho } from '../common/sentence.util';
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
  /** False once the caller has talked over this reply: nothing more of it is synthesised. */
  live: () => boolean;
}

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

  private ttsProvider(): TtsProvider {
    return this.ttsFactory.getProvider(this.constantsService.private.RESERVATION_VOICE.TTS_PROVIDER) as TtsProvider;
  }

  /**
   * What the voice is given to say. Delivery cues like "[warm]" are tone
   * direction only ElevenLabs v3 understands; every other provider would read
   * them out, so they are removed for it.
   */
  private spoken(text: string): string {
    const rv = this.constantsService.private.RESERVATION_VOICE;
    const resolved = rv.TTS_PROVIDER && rv.TTS_PROVIDER.length > 0
      ? rv.TTS_PROVIDER
      : this.constantsService.private.LLM.TTS_CONFIG.PROVIDER;
    return resolved.toLowerCase() === 'elevenlabs' ? stripToolEcho(text).trim() : stripAudioTags(text);
  }

  private fillerKey(phrase: string, languageCode: string | null): string {
    return `${this.constantsService.private.RESERVATION_VOICE.FILLER_CACHE_KEY_PREFIX}${languageCode ?? 'auto'}:${phrase}`;
  }

  /** Speak each finished sentence as it lands so the caller hears a reply sooner. */
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
    for (const sentence of parts) {
      const spoken = this.spoken(sentence);
      const shown = stripAudioTags(sentence);
      if (spoken.length > 0) {
        // Caught per sentence on purpose. The queue is one promise chain, so a
        // single rejected request would poison every .then() after it and the
        // caller would hear the reply stop mid-thought with no error anywhere.
        // One bad fragment should cost that fragment, not the rest of the answer.
        state.ttsQueue = state.ttsQueue
          .then(() => (state.live() ? provider.streamToClient(client, spoken, { emitEnd: false, languageCode }) : undefined))
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
   * Speech-to-text occasionally never says the caller stopped — a dropped frame,
   * a noisy line — and the caller is then left speaking to a microphone that never
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
    const ip = this.reservationService.clientIp(client);
    if (!this.reservationService.claimVoiceSession(ip)) {
      client.emit('error', { message: strings.ERROR_RESERVATION_VOICE_TOO_MANY_SESSIONS });
      client.disconnect(true);
      return;
    }
    client.voiceIp = ip;

    const result = await this.reservationService.connect(client);
    if (!result) {
      return;
    }
    client.turnsUsed = 0;
    client.audioBytes = 0;
    // A call coming back after a dropped line carries on where it was, as the
    // concierge does: answering the phone again would sound like a new call
    // that has forgotten the old one.
    client.greeted = result.messages.length > 0;

    const cfg = this.constantsService.private.RESERVATION_VOICE;
    // Hard stop on wall clock, when one is configured: an abandoned tab must
    // not hold STT open forever. Zero means no cap.
    if (cfg.MAX_SESSION_SECONDS > 0) {
      client.sessionTimer = setTimeout(() => {
        this.endCall(client, strings.ERROR_RESERVATION_VOICE_SESSION_EXPIRED);
      }, cfg.MAX_SESSION_SECONDS * 1000);
    }
    client.emit('voice_ready');
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
          // Not the property's own name. Given it, Sarvam heard it in background
          // noise — "Bad Hotel." arrived as the caller's words, call after call
          // at that property — and a caller on the hotel's own line rarely says
          // its name anyway.
          keyterms: cfg.STT_KEYTERMS,
        });
      client.sttSession = sttSession;
      // Speech-to-text finalises in several pieces within one utterance — "hello" can
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
        // The connection stays open for the caller's next turn. Measured: Sarvam
        // refuses a connection opened soon after five others, so one per turn
        // left the sixth turn of a call — and every one after it — unheard.
        client.emit('voice_turn_end');
        // Interim text is the fallback: better to answer what we heard than to
        // leave the caller talking to silence.
        const heard = state.finalParts.length > 0 ? state.finalParts.join(' ') : state.interim;
        void this.handleTurn(client, heard);
      };
      client.runTurn = runTurn;

      sttSession.onTranscript((text: string, isFinal?: boolean) => {
        // Anything after the turn has run belongs to no one: it was answered.
        if (state.done) {
          return;
        }
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
   * Warming on demand leaves most calls without one, since a phrase picked from
   * two dozen is rarely reused before the next deploy empties the cache.
   *
   * Never awaited: a TTS outage must not stop the gateway coming up.
   */
  onModuleInit(): void {
    const cfg = this.constantsService.private.RESERVATION_VOICE;
    const phrases = cfg.THINKING_FILLERS ?? [];
    if (phrases.length === 0) {
      return;
    }
    void (async () => {
      try {
        const provider = this.ttsProvider();
        for (const phrase of phrases) {
          const spoken = this.spoken(phrase);
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
   * PCM for one phrase, synthesised once and replayed from memory — a filler that
   * waited for a TTS round trip would add the delay it exists to hide.
   *
   * The provider writes to a collector rather than the socket, which captures the
   * audio without changing the TTS interface.
   */
  private async getFillerChunks(phrase: string, languageCode: string | null, provider: TtsProvider): Promise<string[]> {
    const cfg = this.constantsService.private.RESERVATION_VOICE;
    const key = this.fillerKey(phrase, languageCode);
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
  private async playThinkingFiller(client: any, out: { emit: (event: string, payload?: any) => void }, provider: TtsProvider, languageCode: string | null): Promise<void> {
    const phrases = this.constantsService.private.RESERVATION_VOICE.THINKING_FILLERS;
    if (!phrases || phrases.length === 0) {
      return;
    }
    let index = Math.floor(Math.random() * phrases.length);
    if (phrases.length > 1 && index === client.lastFiller) {
      index = (index + 1) % phrases.length;
    }
    client.lastFiller = index;

    const spoken = this.spoken(phrases[index]);
    if (!spoken) {
      return;
    }
    // Only play one already in memory: the answer queues behind whatever this
    // returns, so synthesising here would add the delay it exists to hide. A cold
    // phrase is warmed in the background and this turn goes without.
    if (!this.cacheService.get<string[]>(this.fillerKey(spoken, languageCode))) {
      void this.getFillerChunks(spoken, languageCode, provider).catch(() => {});
      return;
    }
    try {
      const chunks = await this.getFillerChunks(spoken, languageCode, provider);
      for (const delta of chunks) {
        out.emit('voice_audio_chunk', { delta });
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

    const text = typeof transcript === 'string' ? transcript.trim() : '';
    // Noise transcribes as "A", "I", "um", "so": not something said to her, so
    // it gets no reply and costs nothing. Real one-word answers — "yes", "no",
    // "two" — are not on the list and go through.
    const words = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
    const noise = words.every((word) => cfg.NOISE_WORDS.includes(word));
    if (!client.reservationContext || !text || noise) {
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

    // A safety net left armed by the last turn must not hand the line back in
    // the middle of this one.
    this.clearPlaybackWait(client);
    client.voiceBusy = true;
    client.emit('voice_user_message', { text });

    // Everything this turn says goes through `out`, which falls silent the
    // moment the caller talks over it: an interrupted reply must not keep
    // arriving behind the caller's own words.
    const turnId = (client.turnId = (client.turnId ?? 0) + 1);
    const out = {
      emit: (event: string, payload?: any) => {
        if (client.turnId === turnId) {
          client.emit(event, payload);
        }
      },
    };
    // Talked over, a reply stops being spoken but is still thought through and
    // saved: a correction the caller made just before cutting in ("three of us,
    // not two") is noted rather than lost. Only the speech is skipped, so the
    // next turn, which waits for this one to keep the conversation in order,
    // waits about a second rather than for audio no one will hear.
    const previous: Promise<void> | undefined = client.replyInFlight;
    let done: () => void = () => {};
    client.replyInFlight = new Promise<void>((resolve) => { done = resolve; });

    try {
      await previous;
      const session = await this.reservationService.ensureSession(client);
      const provider = this.ttsProvider();
      const languageCode = session.languageCode ?? null;
      // Speak a thinking noise now, while the model is still working. The client
      // queues audio in order, so this plays first and the answer follows on.
      // It goes out on every turn: these say only "I heard you", which is always
      // true, so there is no judgement call about whether one is warranted.
      const state: TurnState = {
        sentenceBuffer: '',
        ttsQueue: this.playThinkingFiller(client, out, provider, languageCode),
        live: () => client.turnId === turnId,
      };

      await this.chatLlmService.streamUserMessage(session, text, {
        mode: 'voice',
        onChunk: (chunk: string) => {
          if (!chunk) return;
          state.sentenceBuffer += chunk;
          this.flushSentences(state, out, provider, languageCode);
        },
        onEnd: async (result) => {
          const spokenTail = this.spoken(state.sentenceBuffer.trim());
          if (spokenTail.length > 0 && state.live()) {
            await state.ttsQueue;
            await provider.streamToClient(out, spokenTail, { emitEnd: true, languageCode });
          } else {
            await state.ttsQueue;
            out.emit('voice_audio_end');
          }
          const reply = stripAudioTags(result.fullContent);
          out.emit('voice_text_end', { text: reply });
          await this.reservationService.followReplyLanguage(session, reply);
        },
      });
    } catch (err: any) {
      this.logger.warn({
        message: err?.message ?? String(err),
        serviceName: 'ReservationVoiceGateway',
        actionName: 'handleTurn',
      });
      out.emit('error', { message: strings.ERROR_RESERVATION_VOICE_FAILED });
      out.emit('voice_audio_end');
    } finally {
      done();
      // The turn ends when the caller has heard the reply, not when the last
      // audio left here — chunks are scheduled ahead, so only the browser
      // knows. It reports back, exactly as the concierge's client does. An
      // interrupted turn has already handed the line over.
      if (client.turnId === turnId) {
        this.armPlaybackWait(client);
      }
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
    // The caller speaking again, on the connection kept from the last turn.
    if (client.sttState.done) {
      Object.assign(client.sttState, { finalParts: [], interim: '', done: false });
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
    // Turn zero, through the same handshake a reply uses: busy while it plays so
    // the open mic cannot hear it, and the browser reports when it has finished.
    // Greeting on connect would be too early — the page only gets permission to
    // make sound inside the tap.
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
    const phrase = (cfg.GREETING ?? '').split(this.constantsService.public.RESERVATION_GREETING_HOTEL_TOKEN).join(name).replace(/\s+/g, ' ').trim();
    if (!phrase) {
      this.createSttSession(client);
      return;
    }

    client.voiceBusy = true;
    try {
      // Cached per property, so only the first caller at a property waits for it.
      const chunks = await this.getFillerChunks(this.spoken(phrase), null, this.ttsProvider());
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

  /**
   * The caller has started talking over the reply — "no, no, the sixth". Stop
   * saying it and listen, the way a person would. Whatever the interrupted turn
   * still has to send is dropped by its own output; `voice_interrupted` marks
   * the point after which the browser may trust incoming audio again.
   */
  @SubscribeMessage('voice_interrupt')
  onVoiceInterrupt(client: any) {
    if (!client.reservationContext) {
      return;
    }
    client.turnId = (client.turnId ?? 0) + 1;
    this.clearPlaybackWait(client);
    client.voiceBusy = false;
    // Always acknowledged, even if the reply had just finished: the browser is
    // discarding audio until it hears this.
    client.emit('voice_interrupted');
    if (!client.sttSession) {
      this.createSttSession(client);
    }
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
