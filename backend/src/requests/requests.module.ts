import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RequestsRepository } from './requests.repository';
import { RequestsService } from './requests.service';
import { BookingsModule } from '../bookings/bookings.module';
import { HotelsModule } from '../hotels/hotels.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RequestsController } from './requests.controller';

@Module({
  imports: [DatabaseModule, forwardRef(() => BookingsModule), forwardRef(() => HotelsModule), forwardRef(() => NotificationsModule)],
  controllers: [RequestsController],
  providers: [RequestsRepository, RequestsService],
  exports: [RequestsRepository, RequestsService],
})
export class RequestsModule {}
