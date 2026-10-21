import { Injectable } from '@nestjs/common';
import WebSocket from 'ws';
import { ConstantsService } from '../common/constants/constants.service';
import { LoggerService } from '../common/logger.service';
import { StreamToClientOptions } from './openai-tts.service';

/** Chat language_code (e.g. en, hi) -> Sarvam BCP-47 target_language_code */
const CHAT_LANGUAGE_TO_SARVAM: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  bn: 'bn-IN',
  gu: 'gu-IN',
  mr: 'mr-IN',
  pa: 'pa-IN',
  or: 'or-IN',
};

@Injectable()
export class SarvamTtsService {
  constructor(
    private readonly constantsService: ConstantsService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Bulbul over Sarvam's streaming socket, one connection per utterance.
   *
   * Streamed, the first audio arrives in ~0.3s including the connection; the
   * whole-clip REST call took 1.5–1.9s for one sentence. A connection kept open
   * for the call would save ~0.1s more, but its audio carries no request id, so
   * an interrupted reply still being made would have to finish before the next
   * one could start. Sarvam does not throttle these connections (15 in a row and
   * 8 at once were all accepted).
   */
  async streamToClient(client: any, text: string, options?: StreamToClientOptions): Promise<void> {
    const sarvam = this.constantsService.private.LLM.TTS_CONFIG.SARVAM;
    if (!sarvam.API_KEY) {
      throw new Error('SARVAM_API_KEY is required for TTS provider sarvam');
    }
    const chatLang = options?.languageCode ?? null;
    const languageCode = (chatLang && CHAT_LANGUAGE_TO_SARVAM[chatLang]) || sarvam.DEFAULT_LANGUAGE;

    // Audio is raw 16-bit PCM in whole samples, so it goes to the player as it comes.
    let sentAudio = false;
    const speak = () => new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`${sarvam.WS_URL}?model=${encodeURIComponent(sarvam.MODEL)}&send_completion_event=true`, {
        headers: { 'Api-Subscription-Key': sarvam.API_KEY },
      });
      const fail = (err: Error) => {
        clearTimeout(timer);
        ws.terminate();
        reject(err);
      };
      const timer = setTimeout(() => fail(new Error(sarvam.NO_AUDIO_ERROR)), sarvam.RESPONSE_TIMEOUT_MS);
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'config',
          data: {
            model: sarvam.MODEL,
            language_code: languageCode,
            speaker: sarvam.SPEAKER,
            pace: sarvam.PACE,
            speech_sample_rate: String(sarvam.SPEECH_SAMPLE_RATE),
            output_audio_codec: sarvam.OUTPUT_CODEC,
          },
        }));
        ws.send(JSON.stringify({ type: 'text', data: { text } }));
        ws.send(JSON.stringify({ type: 'flush' }));
      });
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'audio') {
          clearTimeout(timer);
          sentAudio = true;
          client.emit('voice_audio_chunk', { delta: msg.data.audio });
        } else if (msg.type === 'event' && msg.data?.event_type === 'final') {
          clearTimeout(timer);
          ws.close();
          resolve();
        } else if (msg.type === 'error') {
          fail(new Error(msg.data?.message));
        }
      });
      ws.on('error', fail);
      // Closed without its final event: keep what was spoken, or let it be asked again.
      ws.on('close', () => {
        clearTimeout(timer);
        if (sentAudio) resolve();
        else reject(new Error(sarvam.NO_AUDIO_ERROR));
      });
    });

    try {
      // Nothing has reached the caller when no audio came, so it is safe to ask once more.
      await speak().catch((err) => {
        if (sentAudio) throw err;
        return speak();
      });
      if (options?.emitEnd !== false) {
        client.emit('voice_audio_end');
      }
    } catch (err: any) {
      this.logger.warn({
        message: err?.message ?? String(err),
        serviceName: 'SarvamTtsService',
        actionName: 'streamToClient',
        traces: [{ provider: 'sarvam' }, { model: sarvam.MODEL }],
      });
      throw err;
    }
  }
}
