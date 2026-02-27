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
import { VoiceRealtimeService } from './voice-realtime.service';
import { VoiceGateway } from './gateway/voice.gateway';
import { CostsModule } from '../costs/costs.module';
import { TtsService } from './tts.service';
import { SttService } from './stt.service';
import { LlmService } from './llm.service';
import { VoiceModularService } from './voice-modular.service';
// Generic providers — swap model via env vars, swap technology by editing the provider file
import { SttProvider } from './stt.provider';
import { TtsProvider } from './tts.provider';
import { LlmProvider } from './llm.provider';

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
  ],
  providers: [
    ChatRepository,
    ChatService,
    ChatGateway,
    VoiceRealtimeService,
    VoiceGateway,
    // STT
    SttProvider,
    SttService,
    // TTS
    TtsProvider,
    TtsService,
    // LLM
    LlmProvider,
    LlmService,
    // Voice pipeline orchestrator
    VoiceModularService,
  ],
  exports: [ChatRepository, ChatService, TtsService, SttService, LlmService, VoiceModularService],
})
export class ChatModule {}
