import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { MessagesModule } from '../messages/messages.module';
import { ChatSummaryModule } from '../chat-summary/chat-summary.module';
import { ChatContextService } from './chat-context.service';

@Module({
  imports: [CommonModule, MessagesModule, ChatSummaryModule],
  providers: [ChatContextService],
  exports: [ChatContextService],
})
export class ChatContextModule {}
