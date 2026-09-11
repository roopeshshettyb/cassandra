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
import { PhoneGateway } from './gateway/phone.gateway';
import { AccountsModule } from '../accounts/accounts.module';
import { VoiceRealtimeService } from './voice-realtime.service';
import { DeepgramVoiceAgentService } from './deepgram-voice-agent.service';
import { CostsModule } from '../costs/costs.module';
import { SttModule } from '../stt/stt.module';
import { TtsModule } from '../tts/tts.module';
import { LlmEvalModule } from '../llm-eval/llm-eval.module';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => BookingsModule),
    AuthModule,
    MessagesModule,
    ChatContextModule,
    forwardRef(() => LangGraphModule),
    CommonModule,
    CostsModule,
    SttModule,
    TtsModule,
    LlmEvalModule,
    AccountsModule,
  ],
  providers: [ChatRepository, ChatService, ChatLlmService, ChatGateway, VoiceGateway, PhoneGateway, VoiceRealtimeService, DeepgramVoiceAgentService],
  // ChatLlmService is exported for the public reservation gateways, which reuse
  // the concierge's message pipeline with no account on the session.
  exports: [ChatRepository, ChatService, ChatLlmService],
})
export class ChatModule {}
