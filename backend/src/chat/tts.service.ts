import { Injectable, Logger } from '@nestjs/common';
import { TtsProvider } from './tts.provider';

export interface ITtsProvider {
  /**
   * Generates audio from text and returns it as a base64 encoded string.
   */
  generateAudio(text: string): Promise<string>;
}

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  private provider: ITtsProvider;

  constructor(private readonly hfProvider: TtsProvider) {
    // Currently only HuggingFace TTS is supported.
    // To add a new provider, implement ITtsProvider and inject it here.
    this.provider = hfProvider;
  }

  async speak(text: string): Promise<string | null> {
    if (!this.provider) {
      this.logger.warn('[TtsService] No TTS provider configured. Skipping audio generation.');
      return null;
    }

    try {
      return await this.provider.generateAudio(text);
    } catch (err) {
      this.logger.error('[TtsService] TTS generation failed', err as Error);
      return null;
    }
  }
}
