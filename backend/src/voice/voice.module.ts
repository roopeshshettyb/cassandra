import { Module, forwardRef } from '@nestjs/common';
import { VoiceGateway } from './voice.gateway';
import { VoiceService } from './voice.service';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [forwardRef(() => ChatModule)],
  providers: [VoiceGateway, VoiceService],
  exports: [VoiceService],
})
export class VoiceModule {}
