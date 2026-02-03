import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RequestsRepository } from './requests.repository';
import { RequestsService } from './requests.service';
import { BookingsModule } from '../bookings/bookings.module';
import { HotelsModule } from '../hotels/hotels.module';

@Module({
  imports: [DatabaseModule, BookingsModule, HotelsModule],
  controllers: [],
  providers: [RequestsRepository, RequestsService],
  exports: [RequestsRepository, RequestsService],
})
export class RequestsModule {}
