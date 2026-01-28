import { Module } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { AwsService } from './aws/aws.service';
import { CacheService } from './cache/cache.service';
import { ConstantsService } from './constants/constants.service';
import { ConstantsController } from './constants/constants.controller';
import { ApiService } from './api/api.service';

@Module({
  controllers: [ConstantsController],
  providers: [LoggerService, AwsService, CacheService, ConstantsService, ApiService],
  exports: [LoggerService, AwsService, CacheService, ConstantsService, ApiService],
})
export class CommonModule {}
