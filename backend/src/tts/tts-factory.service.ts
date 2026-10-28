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

  /**
   * `override` lets one surface pick a voice provider without moving everyone.
   * Omitted, it resolves the global TTS_PROVIDER exactly as before.
   */
  getProvider(override?: string | null): OpenaiTtsService | HuggingfaceTtsService | SarvamTtsService | LightningTtsService {
    const configured = override && override.length > 0 ? override : this.constantsService.private.LLM.TTS_CONFIG.PROVIDER;
    const provider = configured.toLowerCase() as TtsProviderId;
    if (provider === 'huggingface') return this.huggingface;
    if (provider === 'sarvam') return this.sarvam;
    if (provider === 'lightning') return this.lightning;
    return this.openai;
  }
}

