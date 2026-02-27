import { Injectable } from '@nestjs/common';
import { SttProvider } from './stt.provider';

export interface ISttProvider {
  transcribe(audioBuffer: Buffer): Promise<string>;
}

@Injectable()
export class SttService {
  private provider: ISttProvider;

  constructor(private readonly hfProvider: SttProvider) {
    // Currently only HuggingFace STT is supported.
    // To add a new provider, implement ISttProvider and inject it here.
    this.provider = hfProvider;
  }

  async transcribe(audioBuffer: Buffer): Promise<string> {
    if (!this.provider) {
      throw new Error('STT Provider not set');
    }
    return this.provider.transcribe(audioBuffer);
  }
}
