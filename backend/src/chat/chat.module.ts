import { Module, forwardRef } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { MessagesRepository } from './messages.repository';
import { VoiceModule } from '../voice/voice.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule, forwardRef(() => VoiceModule)],
  controllers: [ChatController],
  providers: [MessagesRepository, ChatService],
  exports: [ChatService],
})
export class ChatModule {}
