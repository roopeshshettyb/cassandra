import { Injectable } from '@nestjs/common';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import type { ISttSession, SttSessionFactory, SttSessionOptions } from './stt-session.interface';
import { ConstantsService } from '../common/constants/constants.service';
import { LoggerService } from '../common/logger.service';

@Injectable()
export class DeepgramSttService implements SttSessionFactory {
  constructor(
    private readonly constantsService: ConstantsService,
    private readonly logger: LoggerService,
  ) {}

  createSession(options?: SttSessionOptions): ISttSession {
    const logger = this.logger;
    const sttConfig = this.constantsService.private.LLM.STT_CONFIG;
    const commonConfig = sttConfig.COMMON;
    const deepgramConfig = sttConfig.DEEPGRAM;
    const apiKey = deepgramConfig.API_KEY;
    if (!apiKey) {
      throw new Error('DEEPGRAM_API_KEY is required for STT provider deepgram');
    }
    const utteranceEndMs = options?.utteranceEndMs ?? deepgramConfig.UTTERANCE_END_MS;
    const language = options?.language || deepgramConfig.LANGUAGE;
    const keyterms = options?.keyterms ?? [];
    const client = createClient(apiKey);
    const live = client.listen.live({
      model: deepgramConfig.MODEL,
      encoding: commonConfig.ENCODING,
      sample_rate: commonConfig.SAMPLE_RATE,
      utterance_end_ms: utteranceEndMs,
      interim_results: true,
      // Both are left out rather than defaulted when unset, so a caller that
      // asks for nothing gets exactly the request Deepgram saw before.
      ...(language ? { language } : {}),
      ...(keyterms.length > 0 ? { keyterm: keyterms } : {}),
    });

    let transcriptCb: ((text: string, isFinal?: boolean) => void) | null = null;
    let endOfSpeechCb: (() => void) | null = null;
    let destroyed = false;

    live.setupConnection();



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
      if (!destroyed) {
        logger.warn({
          message: err?.message ?? String(err),
          serviceName: 'DeepgramSttService',
          actionName: 'createSession',
          traces: [{ stage: 'live' }],
        });
      }
    });



    return {
      writeAudio(buffer: Buffer) {
        if (destroyed || !live.isConnected()) return;
        try {
          const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
          live.send(ab);
        } catch (e) {
          if (!destroyed) {
            logger.warn({
              message: e instanceof Error ? e.message : String(e),
              serviceName: 'DeepgramSttService',
              actionName: 'writeAudio',
              traces: [{ stage: 'send' }],
            });
          }
        }
      },
      endInput() {
        if (destroyed) return;
        if (live.finalize) live.finalize();
        if (live.requestClose) live.requestClose();
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
        if (live.requestClose) live.requestClose();
        if (live.disconnect) live.disconnect();
      },
    };
  }
}
