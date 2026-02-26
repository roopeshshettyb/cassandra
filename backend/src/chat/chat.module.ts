import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { BookingsModule } from '../bookings/bookings.module';
import { AuthModule } from '../auth/auth.module';
import { MessagesModule } from '../messages/messages.module';
import { ChatContextModule } from '../chat-context/chat-context.module';
import { LangGraphModule } from '../langgraph/langgraph.module';
import { CommonModule } from '../common/common.module';
import { ChatRepository } from './chat.repository';
import { ChatService } from './chat.service';
import { ChatGateway } from './gateway/chat.gateway';
import { VoiceGateway } from './gateway/voice.gateway';
import { CostsModule } from '../costs/costs.module';
import { SttModule } from '../stt/stt.module';

@Module({
  imports: [
    DatabaseModule,
    BookingsModule,
    AuthModule,
    MessagesModule,
    ChatContextModule,
    forwardRef(() => LangGraphModule),
    CommonModule,
    CostsModule,
    SttModule,
  ],
  providers: [ChatRepository, ChatService, ChatGateway, VoiceGateway],
  exports: [ChatRepository, ChatService],
})
export class ChatModule {}
