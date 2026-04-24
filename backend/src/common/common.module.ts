import { Module, Global } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { AwsService } from './aws/aws.service';
import { CacheService } from './cache/cache.service';
import { ConstantsService } from './constants/constants.service';
import { ConstantsController } from './constants/constants.controller';
import { ApiService } from './api/api.service';
import { MapsService } from './maps/maps.service';
import { TavilyService } from './tavily/tavily.service';

@Global()
@Module({
  controllers: [ConstantsController],
  providers: [LoggerService, AwsService, CacheService, ConstantsService, ApiService, MapsService, TavilyService],
  exports: [LoggerService, AwsService, CacheService, ConstantsService, ApiService, MapsService, TavilyService],
})
export class CommonModule {}
