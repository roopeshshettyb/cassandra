import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { LoginTicket, OAuth2Client } from 'google-auth-library';
import { AuthType } from '../../accounts/accounts.model';
import { ConstantsService } from '../../common/constants/constants.service';
import { LoggerService } from '../../common/logger.service';

@Injectable()
export class GoogleService {
  private client: OAuth2Client;

  constructor(private constantsService: ConstantsService, private readonly loggerService: LoggerService) {
    const privateConstants = this.constantsService.private;
    this.client = new OAuth2Client(privateConstants.GOOGLE_CLIENT_ID);
  }

  async handleCallback(body: any): Promise<{
    uuid: string;
    oauthMeta: any;
    email: string;
    name: string;
    profilePicUrl: string;
    username: string;
    description: string;
  }> {
    const privateConstants = this.constantsService.private;

    const { id_token } = body;
    if (!id_token) {
      throw new BadRequestException(privateConstants.OAUTH.ERROR_MISSING_ID_TOKEN);
    }

    // google-auth-library throws a bare Error on a bad or wrong-audience token.
    // Left unwrapped that surfaces as a 500, which reads as "our server is broken"
    // when the real cause is a client-id mismatch — exactly the case that made a
    // credential rotation look like an outage.
    let ticket: LoginTicket;
    try {
      ticket = await this.client.verifyIdToken({
        idToken: id_token,
        audience: privateConstants.GOOGLE_CLIENT_ID,
      });
    } catch (error) {
      this.loggerService.error({ error, serviceName: 'GoogleService', actionName: 'verifyIdToken' });
      throw new UnauthorizedException(privateConstants.OAUTH.ERROR_GOOGLE_TOKEN_REJECTED);
    }

    const payload = ticket.getPayload();
    const email = payload.email;
    const uuid = email;
    const name = payload.name || '';
    const profilePicUrl = payload.picture;

    const oauthMeta = {
      google: {},
    };

    return {
      uuid,
      oauthMeta,
      email,
      name,
      profilePicUrl,
      username: '',
      description: '',
    };
  }
}
