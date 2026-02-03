import { Module } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  providers: [MailerService],
  exports: [MailerService],
})
export class MailerModule {}
