import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ElevenlabsTtsService } from './elevenlabs-tts.service';
import { EchoTtsCacheService } from './echo-tts-cache.service';
import { HuggingfaceTtsService } from './huggingface-tts.service';
import { LightningTtsService } from './lightning-tts.service';
import { OpenaiTtsService } from './openai-tts.service';
import { SarvamTtsService } from './sarvam-tts.service';
import { TtsFactoryService } from './tts-factory.service';

@Module({
  imports: [CommonModule],
  providers: [OpenaiTtsService, ElevenlabsTtsService, HuggingfaceTtsService, SarvamTtsService, LightningTtsService, TtsFactoryService, EchoTtsCacheService],
  exports: [TtsFactoryService, EchoTtsCacheService],
})
export class TtsModule {}

