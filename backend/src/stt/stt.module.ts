import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { DeepgramSttService } from './deepgram-stt.service';
import { OpenaiSttService } from './openai-stt.service';
import { SarvamSttService } from './sarvam-stt.service';
import { SttFactoryService } from './stt-factory.service';

@Module({
  imports: [CommonModule],
  providers: [DeepgramSttService, OpenaiSttService, SarvamSttService, SttFactoryService],
  exports: [SttFactoryService],
})
export class SttModule {}
