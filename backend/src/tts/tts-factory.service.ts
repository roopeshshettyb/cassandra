import { Injectable } from '@nestjs/common';
import { ConstantsService } from '../common/constants/constants.service';
import { HuggingfaceTtsService } from './huggingface-tts.service';
import { LightningTtsService } from './lightning-tts.service';
import { OpenaiTtsService } from './openai-tts.service';
import { SarvamTtsService } from './sarvam-tts.service';

export type TtsProviderId = 'openai' | 'huggingface' | 'sarvam' | 'lightning';

@Injectable()
export class TtsFactoryService {
  constructor(
    private readonly openai: OpenaiTtsService,
    private readonly huggingface: HuggingfaceTtsService,
    private readonly sarvam: SarvamTtsService,
    private readonly lightning: LightningTtsService,
    private readonly constantsService: ConstantsService,
  ) {}

  getProvider(): OpenaiTtsService | HuggingfaceTtsService | SarvamTtsService | LightningTtsService {
    const provider = this.constantsService.private.LLM.TTS_CONFIG.PROVIDER.toLowerCase() as TtsProviderId;
    if (provider === 'huggingface') return this.huggingface;
    if (provider === 'sarvam') return this.sarvam;
    if (provider === 'lightning') return this.lightning;
    return this.openai;
  }
}

