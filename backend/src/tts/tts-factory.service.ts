import { Injectable } from '@nestjs/common';
import { ConstantsService } from '../common/constants/constants.service';
import { OpenaiTtsService } from './openai-tts.service';

export type TtsProviderId = 'openai';

@Injectable()
export class TtsFactoryService {
  constructor(
    private readonly openai: OpenaiTtsService,
    private readonly constantsService: ConstantsService,
  ) {}

  getProvider(): OpenaiTtsService {
    const provider = this.constantsService.private.LLM.TTS_CONFIG.PROVIDER.toLowerCase() as TtsProviderId;
    // Only OpenAI for now; this is where additional providers would plug in.
    if (provider === 'openai') return this.openai;
    return this.openai;
  }
}

