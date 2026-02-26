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
import { ChatLlmService } from './chat-llm.service';
import { ChatGateway } from './gateway/chat.gateway';
import { VoiceGateway } from './gateway/voice.gateway';
import { CostsModule } from '../costs/costs.module';
import { SttModule } from '../stt/stt.module';
import { TtsModule } from '../tts/tts.module';

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
    TtsModule,
  ],
  providers: [ChatRepository, ChatService, ChatLlmService, ChatGateway, VoiceGateway],
  exports: [ChatRepository, ChatService],
})
export class ChatModule {}
