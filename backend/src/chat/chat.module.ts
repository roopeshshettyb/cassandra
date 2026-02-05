import { Module } from '@nestjs/common';
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
import { VoiceRealtimeService } from './voice-realtime.service';
import { VoiceGateway } from './gateway/voice.gateway';

@Module({
  imports: [
    DatabaseModule,
    BookingsModule,
    AuthModule,
    MessagesModule,
    ChatContextModule,
    LangGraphModule,
    CommonModule,
  ],
  providers: [ChatRepository, ChatService, ChatGateway, VoiceRealtimeService, VoiceGateway],
  exports: [ChatRepository, ChatService],
})
export class ChatModule {}
