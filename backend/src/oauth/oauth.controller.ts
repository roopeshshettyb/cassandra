import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { OAuthService } from './oauth.service';
import { EmailService } from './email/email.service';
import { ConstantsService } from '../common/constants/constants.service';
import { CurrentAccount } from '../auth/decorators/account.decorator';

@Controller('oauth')
export class OAuthController {
  constructor(private oauthService: OAuthService, private emailService: EmailService, private constantsService: ConstantsService) {}

  @Post('callback')
  async callback(@Body() body: any, @CurrentAccount() account?: any) {
    if (!body.authType) {
      throw new BadRequestException(this.constantsService.private.OAUTH.ERROR_MISSING_AUTH_TYPE);
    }

    const { account: resultAccount, token: jwtToken } = await this.oauthService.handleCallback(body, account);
    return { account: resultAccount, token: jwtToken };
  }

  @Post('email/send-otp')
  async sendOtp(@Body() body: { email?: string }) {
    const email = body?.email;
    if (!email || typeof email !== 'string') {
      throw new BadRequestException(this.constantsService.private.OAUTH.ERROR_EMAIL_REQUIRED);
    }
    await this.emailService.sendOtp(email);
    return { success: true };
  }
}
