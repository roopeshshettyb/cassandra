import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { AccountsModule } from '../accounts/accounts.module';
import { HotelsModule } from '../hotels/hotels.module';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { InventoryService } from './inventory.service';
import { RoomInventoryRepository, RoomTypesRepository, RoomsRepository } from './rooms.repository';

@Module({
  imports: [DatabaseModule, CommonModule, AuthModule, AccountsModule, forwardRef(() => HotelsModule)],
  controllers: [RoomsController],
  providers: [RoomInventoryRepository, RoomTypesRepository, RoomsRepository, InventoryService, RoomsService],
  exports: [InventoryService],
})
export class RoomsModule {}
