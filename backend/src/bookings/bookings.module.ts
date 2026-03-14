import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingsRepository } from './bookings.repository';
import { DocumentExtractionService } from './document-extraction.service';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthModule } from '../auth/auth.module';
import { MailerModule } from '../mailer/mailer.module';
import { HotelsModule } from '../hotels/hotels.module';
import { CostsModule } from '../costs/costs.module';
import { LangGraphModule } from '../langgraph/langgraph.module';

@Module({
  imports: [DatabaseModule, CommonModule, AccountsModule, AuthModule, MailerModule, forwardRef(() => HotelsModule), forwardRef(() => CostsModule), forwardRef(() => LangGraphModule)],
  controllers: [BookingsController],
  providers: [BookingsRepository, BookingsService, DocumentExtractionService],
  exports: [BookingsRepository, BookingsService],
})
export class BookingsModule {}
