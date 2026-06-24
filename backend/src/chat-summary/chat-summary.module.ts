import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MessagesModule } from '../messages/messages.module';
import { CostsModule } from '../costs/costs.module';
import { ChatSummaryRepository } from './chat-summary.repository';
import { ChatSummaryService } from './chat-summary.service';

@Module({
  imports: [DatabaseModule, MessagesModule, CostsModule],
  providers: [ChatSummaryRepository, ChatSummaryService],
  exports: [ChatSummaryService],
})
export class ChatSummaryModule {}
