import { Injectable } from '@nestjs/common';
import { ConstantsService } from '../common/constants/constants.service';
import { LoggerService } from '../common/logger.service';
import { StreamToClientOptions } from './openai-tts.service';

/** Chat language_code -> Lightning v2 language enum (en, hi, ta, te, kn, ml, etc.) */
const CHAT_LANGUAGE_TO_LIGHTNING: Record<string, string> = {
  en: 'en',
  hi: 'hi',
  ta: 'ta',
  te: 'te',
  kn: 'kn',
  ml: 'ml',
  bn: 'bn',
  gu: 'gu',
  mr: 'mr',
  es: 'es',
  fr: 'fr',
  de: 'de',
  it: 'it',
  nl: 'nl',
  pl: 'pl',
  ru: 'ru',
};

@Injectable()
export class LightningTtsService {
  constructor(
    private readonly constantsService: ConstantsService,
    private readonly logger: LoggerService,
  ) {}

  async streamToClient(client: any, text: string, options?: StreamToClientOptions): Promise<void> {
    const ttsConfig = this.constantsService.private.LLM.TTS_CONFIG;
    const lightning = ttsConfig.LIGHTNING;

    const apiKey = lightning.API_KEY;
    if (!apiKey) {
      throw new Error('LIGHTNING_TTS_API_KEY is required for TTS provider lightning');
    }

    const url = `${lightning.BASE_URL}/api/v1/${lightning.MODEL}/get_speech`;
    const chatLang = options?.languageCode ?? null;
    const language = (chatLang && CHAT_LANGUAGE_TO_LIGHTNING[chatLang]) ? CHAT_LANGUAGE_TO_LIGHTNING[chatLang] : 'en';

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice_id: lightning.VOICE_ID,
          language,
          sample_rate: lightning.SAMPLE_RATE,
          speed: lightning.SPEED,
          output_format: lightning.OUTPUT_FORMAT,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        const contentType = res.headers.get('content-type') ?? '';
        let message = errBody || res.statusText;
        if (contentType.includes('application/json')) {
          try {
            const errJson = JSON.parse(errBody);
            message = errJson.message ?? errJson.error ?? message;
          } catch {
            // keep message as errBody
          }
        }
        throw new Error(message);
      }

      const contentType = res.headers.get('content-type') ?? '';
      const arrayBuffer = await res.arrayBuffer();
      let audioBuffer = Buffer.from(arrayBuffer);

      if (contentType.includes('wav') && audioBuffer.length > 44) {
        audioBuffer = audioBuffer.subarray(44);
      }

      const base64 = audioBuffer.toString('base64');
      client.emit('voice_audio_chunk', { delta: base64 });

      const emitEnd = options?.emitEnd !== false;
      if (emitEnd) {
        client.emit('voice_audio_end');
      }
    } catch (err: any) {
      this.logger.warn({
        message: err?.message ?? String(err),
        serviceName: 'LightningTtsService',
        actionName: 'streamToClient',
        traces: [{ provider: 'lightning' }],
      });
      throw err;
    }
  }
}
