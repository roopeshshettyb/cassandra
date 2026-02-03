import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { HotelsController } from './hotels.controller';
import { HotelAccountsRepository, HotelsRepository } from './hotels.repository';
import { HotelsService } from './hotels.service';
import { AccountsModule } from '../accounts/accounts.module';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [DatabaseModule, CommonModule, AccountsModule, MailerModule],
  controllers: [HotelsController],
  providers: [HotelsRepository, HotelAccountsRepository, HotelsService],
  exports: [HotelsService],
})
export class HotelsModule {}
