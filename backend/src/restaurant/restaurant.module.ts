import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { HotelsModule } from '../hotels/hotels.module';
import { CommonModule } from '../common/common.module';
import { LangGraphModule } from '../langgraph/langgraph.module';
import { RestaurantController } from './restaurant.controller';
import { RestaurantService } from './restaurant.service';
import { RestaurantRepository } from './restaurant.repository';

@Module({
  imports: [DatabaseModule, forwardRef(() => HotelsModule), CommonModule, forwardRef(() => LangGraphModule)],
  controllers: [RestaurantController],
  providers: [RestaurantRepository, RestaurantService],
  exports: [RestaurantService],
})
export class RestaurantModule {}
