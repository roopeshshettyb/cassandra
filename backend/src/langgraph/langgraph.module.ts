import { Module, forwardRef } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { RequestsModule } from '../requests/requests.module';
import { RestaurantModule } from '../restaurant/restaurant.module';
import { LangGraphService } from './langgraph.service';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [BookingsModule, RequestsModule, RestaurantModule, forwardRef(() => ChatModule)],
  providers: [LangGraphService],
  exports: [LangGraphService],
})
export class LangGraphModule {}
