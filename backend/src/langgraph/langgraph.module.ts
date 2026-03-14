import { Module, forwardRef } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { RequestsModule } from '../requests/requests.module';
import { RestaurantModule } from '../restaurant/restaurant.module';
import { LangGraphService } from './langgraph.service';
import { RealtimeToolsService } from './realtime-tools.service';
import { ChatModule } from '../chat/chat.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [forwardRef(() => BookingsModule), RequestsModule, RestaurantModule, forwardRef(() => ChatModule), CommonModule],
  providers: [LangGraphService, RealtimeToolsService],
  exports: [LangGraphService, RealtimeToolsService],
})
export class LangGraphModule {}
