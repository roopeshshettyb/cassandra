import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { RequestsModule } from '../requests/requests.module';
import { LangGraphService } from './langgraph.service';

@Module({
  imports: [BookingsModule, RequestsModule],
  providers: [LangGraphService],
  exports: [LangGraphService],
})
export class LangGraphModule {}
