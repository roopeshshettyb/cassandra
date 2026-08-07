import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { HotelsController } from './hotels.controller';
import { HotelAccountsRepository, HotelsRepository, HotelBrandsRepository } from './hotels.repository';
import { HotelsService } from './hotels.service';
import { OnboardingService } from './onboarding.service';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthModule } from '../auth/auth.module';
import { MailerModule } from '../mailer/mailer.module';
import { BookingsModule } from '../bookings/bookings.module';
import { LangGraphModule } from '../langgraph/langgraph.module';
import { LlmEvalModule } from '../llm-eval/llm-eval.module';

@Module({
  imports: [
    DatabaseModule,
    CommonModule,
    AccountsModule,
    AuthModule,
    MailerModule,
    forwardRef(() => BookingsModule),
    forwardRef(() => LangGraphModule),
    forwardRef(() => LlmEvalModule),
  ],
  controllers: [HotelsController],
  providers: [HotelsRepository, HotelAccountsRepository, HotelBrandsRepository, HotelsService, OnboardingService],
  exports: [HotelsService, HotelAccountsRepository, HotelBrandsRepository, OnboardingService],
})
export class HotelsModule {}
