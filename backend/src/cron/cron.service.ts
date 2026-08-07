import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CacheService } from '../common/cache/cache.service';
import { BookingsService } from '../bookings/bookings.service';

@Injectable()
export class CronService {
  constructor(
    private cacheService: CacheService,
    private bookingsService: BookingsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  handleCacheCleanup() {
    this.cacheService.size();
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async sendPendingBookingInvites() {
    await this.bookingsService.sendPendingInviteEmails();
  }
}
