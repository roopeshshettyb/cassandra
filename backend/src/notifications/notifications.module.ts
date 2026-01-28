import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';
import { DatabaseModule } from '../database/database.module';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [DatabaseModule, AccountsModule],
  controllers: [NotificationsController],
  providers: [NotificationsRepository, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

