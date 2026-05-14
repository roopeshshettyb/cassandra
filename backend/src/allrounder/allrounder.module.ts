import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HotelsModule } from '../hotels/hotels.module';
import { RequestsModule } from '../requests/requests.module';
import { BookingsModule } from '../bookings/bookings.module';
import { SttModule } from '../stt/stt.module';
import { TtsModule } from '../tts/tts.module';
import { CommonModule } from '../common/common.module';
import { CostsModule } from '../costs/costs.module';
import { ChatContextModule } from '../chat-context/chat-context.module';
import { AllRounderGateway } from './allrounder.gateway';
import { AllRounderLlmService } from './allrounder-llm.service';
import { AllRounderChatService, AllRounderChatRepository, AllRounderMessageRepository } from './allrounder-chat.service';

@Module({
  imports: [
    AuthModule,
    forwardRef(() => HotelsModule),
    forwardRef(() => RequestsModule),
    forwardRef(() => BookingsModule),
    forwardRef(() => CostsModule),
    SttModule,
    TtsModule,
    CommonModule,
    ChatContextModule,
  ],
  providers: [
    AllRounderChatRepository,
    AllRounderMessageRepository,
    AllRounderChatService,
    AllRounderGateway,
    AllRounderLlmService,
  ],
})
export class AllRounderModule {}
