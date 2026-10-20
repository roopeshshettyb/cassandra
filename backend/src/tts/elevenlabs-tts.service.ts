import { Injectable } from '@nestjs/common';
import { ConstantsService } from '../common/constants/constants.service';
import { LoggerService } from '../common/logger.service';
import { StreamToClientOptions } from './openai-tts.service';

/** Chat language code -> ElevenLabs ISO 639-1 code. */
const CHAT_LANGUAGE_TO_ELEVENLABS: Record<string, string> = {
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
export class ElevenlabsTtsService {
  constructor(
    private readonly constantsService: ConstantsService,
    private readonly logger: LoggerService,
  ) {}

  /** Best-effort message out of ElevenLabs' error envelope, which nests under `detail`. */
  private async readError(res: Response): Promise<string> {
    const body = await res.text();
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return body || res.statusText;
    }
    try {
      const parsed = JSON.parse(body);
      const detail = parsed.detail;
      if (typeof detail === 'string') {
        return detail;
      }
      return detail?.message ?? parsed.message ?? body ?? res.statusText;
    } catch {
      return body || res.statusText;
    }
  }

  async streamToClient(client: any, text: string, options?: StreamToClientOptions): Promise<void> {
    const elevenlabs = this.constantsService.private.LLM.TTS_CONFIG.ELEVENLABS;

    const apiKey = elevenlabs.API_KEY;
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY is required for TTS provider elevenlabs');
    }

    const url = `${elevenlabs.BASE_URL}/v1/text-to-speech/${elevenlabs.VOICE_ID}/stream?output_format=${elevenlabs.OUTPUT_FORMAT}`;

    const chatLang = options?.languageCode ?? null;
    const languageCode = chatLang ? CHAT_LANGUAGE_TO_ELEVENLABS[chatLang] : null;
    // eleven_v3 rejects the request outright when language_code is present, so it
    // only goes out for the models that actually enforce a language.
    const enforcesLanguage = elevenlabs.LANGUAGE_ENFORCING_MODELS.includes(elevenlabs.MODEL);

    const audioTag = elevenlabs.AUDIO_TAG ? elevenlabs.AUDIO_TAG.trim() : '';
    const settings = elevenlabs.VOICE_SETTINGS;

    try {
      // Only the wait for an answer is timed, not the audio that follows it.
      const request = async (init: RequestInit) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), elevenlabs.RESPONSE_TIMEOUT_MS);
        try {
          return await fetch(url, { ...init, signal: controller.signal });
        } finally {
          clearTimeout(timer);
        }
      };
      const init: RequestInit = {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: audioTag ? `${audioTag} ${text}` : text,
          model_id: elevenlabs.MODEL,
          voice_settings: {
            stability: settings.STABILITY,
            similarity_boost: settings.SIMILARITY_BOOST,
            style: settings.STYLE,
            use_speaker_boost: settings.USE_SPEAKER_BOOST,
            speed: settings.SPEED,
          },
          ...(languageCode && enforcesLanguage && { language_code: languageCode }),
        }),
      };
      // Nothing has been sent to the caller when a request fails to answer, so it
      // is safe to ask once more.
      const res = await request(init).catch(() => request(init));

      if (!res.ok) {
        throw new Error(await this.readError(res));
      }

      if (!res.body) {
        throw new Error('ElevenLabs returned no audio stream');
      }

      // Forward audio as it arrives rather than buffering the whole utterance —
      // the point of the streaming endpoint is that speech starts sooner.
      //
      // Chunks are cut at 16-bit sample boundaries: the browser player floors
      // byte length to whole samples and discards a trailing odd byte, which
      // would shift every later sample by one byte and turn the rest of the
      // utterance into static. Any odd byte is carried into the next chunk.
      const reader = res.body.getReader();
      let carry: Buffer = Buffer.alloc(0);

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || value.length === 0) continue;

        const combined = carry.length > 0 ? Buffer.concat([carry, Buffer.from(value)]) : Buffer.from(value);
        const alignedLength = combined.length - (combined.length % 2);
        if (alignedLength === 0) {
          carry = combined;
          continue;
        }

        carry = combined.subarray(alignedLength);
        client.emit('voice_audio_chunk', { delta: combined.subarray(0, alignedLength).toString('base64') });
      }

      const emitEnd = options?.emitEnd !== false;
      if (emitEnd) {
        client.emit('voice_audio_end');
      }
    } catch (err: any) {
      this.logger.warn({
        message: err?.message ?? String(err),
        serviceName: 'ElevenlabsTtsService',
        actionName: 'streamToClient',
        traces: [{ provider: 'elevenlabs' }, { model: elevenlabs.MODEL }],
      });
      throw err;
    }
  }
}
