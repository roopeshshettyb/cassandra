import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { CommonModule } from '../common/common.module';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [CommonModule, BookingsModule],
  providers: [CronService],
})
export class CronModule {}
