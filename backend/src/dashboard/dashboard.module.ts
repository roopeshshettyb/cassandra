import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { BookingsModule } from '../bookings/bookings.module';
import { RequestsModule } from '../requests/requests.module';

@Module({
  imports: [BookingsModule, RequestsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
