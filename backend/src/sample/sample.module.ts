import { Module } from '@nestjs/common';
import { SampleController } from './sample.controller';
import { SampleRepository } from './sample.repository';
import { SampleService } from './sample.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [SampleController],
  providers: [SampleRepository, SampleService],
  exports: [SampleService],
})
export class SampleModule {}
