import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { HuggingfaceTtsService } from './huggingface-tts.service';
import { OpenaiTtsService } from './openai-tts.service';
import { TtsFactoryService } from './tts-factory.service';

@Module({
  imports: [CommonModule],
  providers: [OpenaiTtsService, HuggingfaceTtsService, TtsFactoryService],
  exports: [TtsFactoryService],
})
export class TtsModule {}

