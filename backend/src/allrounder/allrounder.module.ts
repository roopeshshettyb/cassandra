import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HotelsModule } from '../hotels/hotels.module';
import { CommonModule } from '../common/common.module';
import { ChatContextModule } from '../chat-context/chat-context.module';
import { LangGraphModule } from '../langgraph/langgraph.module';
import { ChatModule } from '../chat/chat.module';
import { AllRounderGateway } from './allrounder.gateway';

@Module({
  imports: [
    AuthModule,
    forwardRef(() => HotelsModule),
    CommonModule,
    ChatContextModule,
    LangGraphModule,
    forwardRef(() => ChatModule),
  ],
  providers: [AllRounderGateway],
})
export class AllRounderModule {}
