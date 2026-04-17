import { Injectable } from '@nestjs/common';
import { ConstantsService } from '../common/constants/constants.service';
import { LoggerService } from '../common/logger.service';
import { StreamToClientOptions } from './openai-tts.service';

@Injectable()
export class HuggingfaceTtsService {
  constructor(
    private readonly constantsService: ConstantsService,
    private readonly logger: LoggerService,
  ) {}

  async streamToClient(client: any, text: string, options?: StreamToClientOptions): Promise<void> {
    const ttsConfig = this.constantsService.private.LLM.TTS_CONFIG;
    const hf = ttsConfig.HUGGINGFACE;

    const apiKey = hf.API_KEY;
    if (!apiKey) {
      throw new Error('HUGGINGFACE_API_KEY or HF_TOKEN is required for TTS provider huggingface');
    }

    const url = hf.BASE_URL ?? `${hf.INFERENCE_BASE_URL}/${hf.MODEL}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text_inputs: text }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        const contentType = res.headers.get('content-type') ?? '';
        let message = errBody || res.statusText;
        if (contentType.includes('application/json')) {
          try {
            const errJson = JSON.parse(errBody);
            message = errJson.error ?? message;
          } catch {
            // keep message as errBody
          }
        }
        if (res.status === 404) {
          message = `${message}. For custom models (e.g. maya1) set HUGGINGFACE_TTS_BASE_URL to your Inference Endpoint URL.`;
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
        serviceName: 'HuggingfaceTtsService',
        actionName: 'streamToClient',
        traces: [{ provider: 'huggingface' }],
      });
      throw err;
    }
  }
}
