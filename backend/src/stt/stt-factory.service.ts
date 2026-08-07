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

  getFactory(): SttSessionFactory {
    const provider = this.constantsService.private.LLM.STT_CONFIG.PROVIDER.toLowerCase() as SttProviderId;
    if (provider === 'openai') return this.openai;
    return this.deepgram;
  }
}
