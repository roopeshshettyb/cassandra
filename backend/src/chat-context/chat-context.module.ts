import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { MessagesModule } from '../messages/messages.module';
import { ChatContextService } from './chat-context.service';

@Module({
  imports: [CommonModule, MessagesModule],
  providers: [ChatContextService],
  exports: [ChatContextService],
})
export class ChatContextModule {}
