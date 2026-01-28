import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CacheService } from '../common/cache/cache.service';

@Injectable()
export class CronService {
  constructor(private cacheService: CacheService) {}

  @Cron(CronExpression.EVERY_HOUR)
  handleCacheCleanup() {
    this.cacheService.size();
  }
}
