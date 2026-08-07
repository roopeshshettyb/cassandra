import { Module } from '@nestjs/common';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { GoogleService } from './google/google.service';
import { XService } from './x/x.service';
import { EmailService } from './email/email.service';
import { AuthModule } from '../auth/auth.module';
import { AccountsModule } from '../accounts/accounts.module';
import { CommonModule } from '../common/common.module';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [AuthModule, AccountsModule, CommonModule, MailerModule],
  controllers: [OAuthController],
  providers: [OAuthService, GoogleService, XService, EmailService],
})
export class OAuthModule {}
