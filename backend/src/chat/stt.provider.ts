import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ISttProvider } from './stt.service';

/**
 * Speech-to-Text provider.
 * Swap the underlying model by changing STT_MODEL in your env file.
 * Swap the underlying service by editing this file only — no other file changes needed.
 */
@Injectable()
export class SttProvider implements ISttProvider {
  private readonly logger = new Logger(SttProvider.name);

  async transcribe(audioBuffer: Buffer): Promise<string> {
    const token = process.env.HUGGINGFACE_TOKEN;
    if (!token) {
      throw new Error('HUGGINGFACE_TOKEN is not set');
    }

    const model = process.env.STT_MODEL || 'openai/whisper-large-v3';
    const apiUrl = `https://router.huggingface.co/hf-inference/models/${model}`;

    this.logger.log(`[SttProvider] model: ${model}`);

    try {
      const response = await axios.post(apiUrl, audioBuffer, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'audio/wav',
          Accept: 'application/json',
        },
      });

      if (response.data && response.data.text) {
        return response.data.text;
      }

      this.logger.warn('[SttProvider] No transcription text returned');
      return '';
    } catch (error) {
      this.logger.error('[SttProvider] Failed to transcribe audio', error as Error);
      throw error;
    }
  }
}
