import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingsRepository } from './bookings.repository';
import { AccountsModule } from '../accounts/accounts.module';
import { MailerModule } from '../mailer/mailer.module';
import { HotelsModule } from '../hotels/hotels.module';

@Module({
  imports: [DatabaseModule, CommonModule, AccountsModule, MailerModule, HotelsModule],
  controllers: [BookingsController],
  providers: [BookingsRepository, BookingsService],
})
export class BookingsModule {}
