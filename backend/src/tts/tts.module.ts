import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { OpenaiTtsService } from './openai-tts.service';
import { TtsFactoryService } from './tts-factory.service';

@Module({
  imports: [CommonModule],
  providers: [OpenaiTtsService, TtsFactoryService],
  exports: [TtsFactoryService],
})
export class TtsModule {}

