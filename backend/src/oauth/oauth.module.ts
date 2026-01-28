import { Module } from '@nestjs/common';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { GoogleService } from './google/google.service';
import { XService } from './x/x.service';
import { AuthModule } from '../auth/auth.module';
import { AccountsModule } from '../accounts/accounts.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [AuthModule, AccountsModule, CommonModule],
  controllers: [OAuthController],
  providers: [OAuthService, GoogleService, XService],
})
export class OAuthModule {}
