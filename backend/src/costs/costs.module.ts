import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { CostsRepository } from './costs.repository';
import { CostsService } from './costs.service';
import { CostsController } from './costs.controller';
import { HotelsModule } from '../hotels/hotels.module';

@Module({
  imports: [DatabaseModule, CommonModule, forwardRef(() => HotelsModule)],
  controllers: [CostsController],
  providers: [CostsRepository, CostsService],
  exports: [CostsRepository, CostsService],
})
export class CostsModule {}

