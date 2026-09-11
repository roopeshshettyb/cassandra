import { Injectable } from '@nestjs/common';
import type { SttSessionFactory } from './stt-session.interface';
import { DeepgramSttService } from './deepgram-stt.service';
import { OpenaiSttService } from './openai-stt.service';
import { ConstantsService } from '../common/constants/constants.service';

export type SttProviderId = 'deepgram' | 'openai';

@Injectable()
export class SttFactoryService {
  constructor(
    private readonly deepgram: DeepgramSttService,
    private readonly openai: OpenaiSttService,
    private readonly constantsService: ConstantsService,
  ) {}

  /**
   * `override` lets one surface pick a provider without moving everyone —
   * the public reservation call and the in-stay concierge can differ. Omitted,
   * it resolves the global STT_PROVIDER exactly as before.
   */
  getFactory(override?: string | null): SttSessionFactory {
    const configured = override && override.length > 0 ? override : this.constantsService.private.LLM.STT_CONFIG.PROVIDER;
    const provider = configured.toLowerCase() as SttProviderId;
    if (provider === 'openai') return this.openai;
    return this.deepgram;
  }
}
