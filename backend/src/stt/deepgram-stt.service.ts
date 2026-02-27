import { Injectable, Logger } from '@nestjs/common';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import type { ISttSession, SttSessionFactory, SttSessionOptions } from './stt-session.interface';
import { ConstantsService } from '../common/constants/constants.service';

@Injectable()
export class DeepgramSttService implements SttSessionFactory {
  private readonly logger = new Logger(DeepgramSttService.name);

  constructor(private readonly constantsService: ConstantsService) {}

  createSession(options?: SttSessionOptions): ISttSession {
    const log = this.logger;
    const sttConfig = this.constantsService.private.LLM.STT_CONFIG;
    const commonConfig = sttConfig.COMMON;
    const deepgramConfig = sttConfig.DEEPGRAM;
    const apiKey = deepgramConfig.API_KEY;
    if (!apiKey) {
      throw new Error('DEEPGRAM_API_KEY is required for STT provider deepgram');
    }
    const utteranceEndMs = deepgramConfig.UTTERANCE_END_MS;
    const endpointingMs = deepgramConfig.ENDPOINTING_MS;
    const language = options?.language;

    const client = createClient(apiKey);
    const live = client.listen.live({
      model: deepgramConfig.MODEL,
      encoding: commonConfig.ENCODING,
      sample_rate: commonConfig.SAMPLE_RATE,
      utterance_end_ms: utteranceEndMs,
      endpointing: endpointingMs,
      interim_results: true,
      ...(language ? { language } : {}),
    });

    let transcriptCb: ((text: string, isFinal?: boolean) => void) | null = null;
    let endOfSpeechCb: (() => void) | null = null;
    let destroyed = false;
    let connected = false;
    // Buffer audio sent before the WebSocket connection is ready
    const pendingAudio: (ArrayBuffer | SharedArrayBuffer)[] = [];

    live.setupConnection();

    live.on(LiveTranscriptionEvents.Open, () => {
      if (destroyed) return;
      connected = true;
      log.debug('[Deepgram] Live connection open');
      // Flush any audio that arrived before the connection was ready
      for (const ab of pendingAudio) {
        try { live.send(ab); } catch (_) {}
      }
      pendingAudio.length = 0;
    });

    live.on(LiveTranscriptionEvents.Transcript, (data: any) => {
      if (destroyed || !transcriptCb) return;
      const alt = data?.channel?.alternatives?.[0];
      const text = alt?.transcript?.trim();
      if (!text) return;

      const isFinal = data?.is_final === true;
      // Forward every transcript; isFinal=true when Deepgram finalizes the segment.
      // speech_final is handled by endpointing — it guarantees is_final transcripts
      // arrive ~500ms before UtteranceEnd, so client.lastTranscript is always set
      // by the time UtteranceEnd fires.
      transcriptCb(text, isFinal);
    });

    live.on(LiveTranscriptionEvents.UtteranceEnd, () => {
      if (destroyed) return;
      log.debug('[Deepgram] UtteranceEnd — triggering end of speech');
      if (endOfSpeechCb) endOfSpeechCb();
    });

    live.on(LiveTranscriptionEvents.Error, (err: any) => {
      if (!destroyed) log.warn('[Deepgram] Live error', err?.message ?? err);
    });

    live.on(LiveTranscriptionEvents.Close, () => {
      if (!destroyed) log.debug('[Deepgram] Live connection closed');
    });

    return {
      writeAudio(buffer: Buffer) {
        if (destroyed) return;
        const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        if (!connected) {
          // Queue audio until the WebSocket is ready
          pendingAudio.push(ab);
          return;
        }
        try {
          live.send(ab);
        } catch (e) {
          if (!destroyed) log.warn('[Deepgram] send error', e);
        }
      },
      endInput() {
        if (destroyed) return;
        try {
          if (live.finalize) live.finalize();
          if (live.requestClose) live.requestClose();
        } catch (_) {}
      },
      onTranscript(callback: (text: string, isFinal?: boolean) => void) {
        transcriptCb = callback;
      },
      onEndOfSpeech(callback: () => void) {
        endOfSpeechCb = callback;
      },
      destroy() {
        destroyed = true;
        transcriptCb = null;
        endOfSpeechCb = null;
        pendingAudio.length = 0;
        try {
          if (live.requestClose) live.requestClose();
          if (live.disconnect) live.disconnect();
        } catch (_) {}
      },
    };
  }
}
