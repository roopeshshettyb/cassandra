import { Injectable, Logger } from '@nestjs/common';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import type { ISttSession, SttSessionFactory } from './stt-session.interface';
import { ConstantsService } from '../common/constants/constants.service';

@Injectable()
export class DeepgramSttService implements SttSessionFactory {
  private readonly logger = new Logger(DeepgramSttService.name);

  constructor(private readonly constantsService: ConstantsService) {}

  createSession(): ISttSession {
    const log = this.logger;
    const sttConfig = this.constantsService.private.LLM.STT_CONFIG;
    const commonConfig = sttConfig.COMMON;
    const deepgramConfig = sttConfig.DEEPGRAM;
    const apiKey = deepgramConfig.API_KEY;
    if (!apiKey) {
      throw new Error('DEEPGRAM_API_KEY is required for STT provider deepgram');
    }
    const utteranceEndMs = deepgramConfig.UTTERANCE_END_MS;
    const client = createClient(apiKey);
    const live = client.listen.live({
      model: deepgramConfig.MODEL,
      encoding: commonConfig.ENCODING,
      sample_rate: commonConfig.SAMPLE_RATE,
      utterance_end_ms: utteranceEndMs,
      interim_results: true,
    });

    let transcriptCb: ((text: string, isFinal?: boolean) => void) | null = null;
    let endOfSpeechCb: (() => void) | null = null;
    let destroyed = false;

    live.setupConnection();

    live.on(LiveTranscriptionEvents.Open, () => {
      if (!destroyed) log.debug('[Deepgram] Live connection open');
    });

    live.on(LiveTranscriptionEvents.Transcript, (data: any) => {
      if (destroyed || !transcriptCb) return;
      const alt = data?.channel?.alternatives?.[0];
      const text = alt?.transcript?.trim();
      if (!text) return;

      const isFinal = data?.is_final === true;
      const speechFinal = data?.speech_final === true;

      // Stream every updated transcript to the callback so the UI can show it live.
      // Mark as final only when Deepgram signals both is_final and speech_final,
      // which corresponds to end-of-utterance in their docs.
      const isUtteranceFinal = isFinal && speechFinal;
      transcriptCb(text, isUtteranceFinal);
    });

    live.on(LiveTranscriptionEvents.UtteranceEnd, () => {
      if (destroyed) return;
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
        if (destroyed || !live.isConnected()) return;
        try {
          const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
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
        try {
          if (live.requestClose) live.requestClose();
          if (live.disconnect) live.disconnect();
        } catch (_) {}
      },
    };
  }
}
