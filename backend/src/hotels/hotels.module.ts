import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { HotelsController } from './hotels.controller';
import { HotelAccountsRepository, HotelsRepository } from './hotels.repository';
import { HotelsService } from './hotels.service';

@Module({
  imports: [DatabaseModule],
  controllers: [HotelsController],
  providers: [HotelsRepository, HotelAccountsRepository, HotelsService],
  exports: [HotelsService],
})
export class HotelsModule {}
