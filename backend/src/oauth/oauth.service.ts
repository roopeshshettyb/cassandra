import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AccountsService } from '../accounts/accounts.service';
import { Account, AccountRole, AuthType } from '../accounts/accounts.model';
import { GoogleService } from './google/google.service';
import { XService } from './x/x.service';
import { EmailService } from './email/email.service';
import { ConstantsService } from '../common/constants/constants.service';

@Injectable()
export class OAuthService {
  constructor(
    private authService: AuthService,
    private accountsService: AccountsService,
    private googleService: GoogleService,
    private xService: XService,
    private emailService: EmailService,
    private constantsService: ConstantsService,
  ) {}

  async handleCallback(body: any, existingAccount?: any): Promise<{ account: any; token: string }> {
    let { authType } = body;
    const serviceMap: { [key: string]: any } = {
      google: this.googleService,
      x: this.xService,
      email: this.emailService,
    };

    const providerService = serviceMap[authType];
    if (!providerService) {
      throw new Error(`Unsupported auth type: ${authType}`);
    }

    const providerData = await providerService.handleCallback(body);
    const { uuid, oauthMeta, email, name, profilePicUrl } = providerData;

    let account: Account;

    if (existingAccount) {
      account = await this.accountsService.findByUuid(existingAccount.uuid);
      if (!account) {
        throw new Error('Account not found');
      }

      const existingOauthMeta = account.oauthMeta || {};
      const mergedOauthMeta = {
        ...existingOauthMeta,
        ...oauthMeta,
      };

      const [affectedCount, updatedAccounts] = await this.accountsService.update({ oauthMeta: mergedOauthMeta }, { uuid: existingAccount.uuid });

      if (affectedCount === 0) {
        throw new Error('Account not found after update');
      }
      account = updatedAccounts[0];
    } else {
      if (authType === AuthType.GOOGLE) authType = AuthType.EMAIL;
      const [upsertedAccount] = await this.accountsService.upsert({
        uuid: `${authType}:${uuid}`,
        oauthMeta,
        email,
        name,
        profilePicUrl,
      });
      account = upsertedAccount;
    }

    const jwtToken = await this.authService.generateToken(account);
    const accountResponse = { ...account.toJSON() };
    delete accountResponse.oauthMeta;
    delete accountResponse.uuid;
    return { account: accountResponse, token: jwtToken };
  }
}
