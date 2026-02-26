import { Injectable } from '@nestjs/common';
import { ConstantsService } from '../common/constants/constants.service';
import { HuggingfaceTtsService } from './huggingface-tts.service';
import { OpenaiTtsService } from './openai-tts.service';

export type TtsProviderId = 'openai' | 'huggingface';

@Injectable()
export class TtsFactoryService {
  constructor(
    private readonly openai: OpenaiTtsService,
    private readonly huggingface: HuggingfaceTtsService,
    private readonly constantsService: ConstantsService,
  ) {}

  getProvider(): OpenaiTtsService | HuggingfaceTtsService {
    const provider = this.constantsService.private.LLM.TTS_CONFIG.PROVIDER.toLowerCase() as TtsProviderId;
    if (provider === 'huggingface') return this.huggingface;
    return this.openai;
  }
}

