import { Controller, Post, Body } from '@nestjs/common';
import { OAuthService } from './oauth.service';
import { CurrentAccount } from '../auth/decorators/account.decorator';

@Controller('oauth')
export class OAuthController {
  constructor(private oauthService: OAuthService) {}

  @Post('callback')
  async callback(@Body() body: any, @CurrentAccount() account?: any) {
    if (!body.authType) {
      throw new Error('Missing authType');
    }

    const { account: resultAccount, token: jwtToken } = await this.oauthService.handleCallback(body, account);
    return { account: resultAccount, token: jwtToken };
  }
}
