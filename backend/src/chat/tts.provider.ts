import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ITtsProvider } from './tts.service';
import { ConfigService } from '@nestjs/config';

/**
 * Text-to-Speech provider.
 * Swap the underlying model by changing TTS_MODEL in your env file.
 * Swap the underlying service by editing this file only — no other file changes needed.
 */
@Injectable()
export class TtsProvider implements ITtsProvider {
  private readonly logger = new Logger(TtsProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async generateAudio(text: string): Promise<string> {
    const token = this.configService.get<string>('HUGGINGFACE_TOKEN');
    if (!token) {
      throw new Error('HUGGINGFACE_TOKEN is missing');
    }

    const model = this.configService.get<string>('TTS_MODEL') || 'mrfakename/MeloTTS-Maya';
    const apiUrl = `https://router.huggingface.co/hf-inference/models/${model}`;
    const description =
      this.configService.get<string>('TTS_VOICE_DESCRIPTION') ||
      'Male voice in their 30s with American accent';

    this.logger.log(`[TtsProvider] model: ${model}, text: "${text.substring(0, 50)}..."`);

    try {
      const response = await axios.post(
        apiUrl,
        { inputs: text, parameters: { description } },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
        },
      );

      return Buffer.from(response.data).toString('base64');
    } catch (err: any) {
      this.logger.error(`[TtsProvider] Failed: ${err.message}`);
      if (err.response) {
        this.logger.error(`[TtsProvider] Response: ${err.response.data.toString()}`);
      }
      throw err;
    }
  }
}
