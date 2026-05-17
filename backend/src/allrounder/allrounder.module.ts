import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HotelsModule } from '../hotels/hotels.module';
import { CommonModule } from '../common/common.module';
import { ChatContextModule } from '../chat-context/chat-context.module';
import { LangGraphModule } from '../langgraph/langgraph.module';
import { AllRounderGateway } from './allrounder.gateway';
import { AllRounderChatService, AllRounderChatRepository, AllRounderMessageRepository } from './allrounder-chat.service';

@Module({
  imports: [
    AuthModule,
    forwardRef(() => HotelsModule),
    CommonModule,
    ChatContextModule,
    LangGraphModule,
  ],
  providers: [
    AllRounderChatRepository,
    AllRounderMessageRepository,
    AllRounderChatService,
    AllRounderGateway,
  ],
})
export class AllRounderModule {}
