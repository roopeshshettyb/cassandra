import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MessagesModule } from '../messages/messages.module';
import { CostsModule } from '../costs/costs.module';
import { LangGraphModule } from '../langgraph/langgraph.module';
import { ChatSummaryRepository } from './chat-summary.repository';
import { ChatSummaryService } from './chat-summary.service';

@Module({
  imports: [DatabaseModule, MessagesModule, CostsModule, forwardRef(() => LangGraphModule)],
  providers: [ChatSummaryRepository, ChatSummaryService],
  exports: [ChatSummaryService],
})
export class ChatSummaryModule {}
