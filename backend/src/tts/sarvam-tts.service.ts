import { Injectable } from '@nestjs/common';
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

  async streamToClient(client: any, text: string, options?: StreamToClientOptions): Promise<void> {
    const ttsConfig = this.constantsService.private.LLM.TTS_CONFIG;
    const sarvam = ttsConfig.SARVAM;

    const apiKey = sarvam.API_KEY;
    if (!apiKey) {
      throw new Error('SARVAM_API_KEY is required for TTS provider sarvam');
    }

    const url = `${sarvam.BASE_URL}/text-to-speech`;
    const chatLang = options?.languageCode ?? null;
    const targetLanguageCode = (chatLang && CHAT_LANGUAGE_TO_SARVAM[chatLang]) ? CHAT_LANGUAGE_TO_SARVAM[chatLang] : 'en-IN';

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'api-subscription-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          target_language_code: targetLanguageCode,
          speaker: sarvam.SPEAKER,
          model: sarvam.MODEL,
          pace: sarvam.PACE,
          speech_sample_rate: sarvam.SPEECH_SAMPLE_RATE,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        const contentType = res.headers.get('content-type') ?? '';
        let message = errBody || res.statusText;
        if (contentType.includes('application/json')) {
          try {
            const errJson = JSON.parse(errBody);
            const errObj = errJson.error;
            message = typeof errObj === 'object' && errObj?.message ? errObj.message : errJson.error ?? message;
          } catch {
            // keep message as errBody
          }
        }
        throw new Error(message);
      }

      const json = (await res.json()) as { audios?: string[] };
      const audios = json.audios;
      if (audios && audios.length > 0) {
        let combined = '';
        for (let i = 0; i < audios.length; i += 1) {
          combined += audios[i];
        }
        let pcmBuffer = Buffer.from(combined, 'base64');
        if (pcmBuffer.length > 44) {
          pcmBuffer = pcmBuffer.subarray(44);
        }
        client.emit('voice_audio_chunk', { delta: pcmBuffer.toString('base64') });
      }

      const emitEnd = options?.emitEnd !== false;
      if (emitEnd) {
        client.emit('voice_audio_end');
      }
    } catch (err: any) {
      this.logger.warn({
        message: err?.message ?? String(err),
        serviceName: 'SarvamTtsService',
        actionName: 'streamToClient',
        traces: [{ provider: 'sarvam' }],
      });
      throw err;
    }
  }
}
