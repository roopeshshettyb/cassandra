import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { RequestsModule } from '../requests/requests.module';
import { LangGraphService } from './langgraph.service';
import { RealtimeToolsService } from './realtime-tools.service';

@Module({
  imports: [BookingsModule, RequestsModule],
  providers: [LangGraphService, RealtimeToolsService],
  exports: [LangGraphService, RealtimeToolsService],
})
export class LangGraphModule {}
