import { Injectable } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { AuthType } from '../../accounts/accounts.model';
import { ConstantsService } from '../../common/constants/constants.service';

@Injectable()
export class GoogleService {
  private client: OAuth2Client;

  constructor(private constantsService: ConstantsService) {
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
    const { id_token } = body;
    if (!id_token) {
      throw new Error('Missing id_token for Google OAuth');
    }

    const privateConstants = this.constantsService.private;

    const ticket = await this.client.verifyIdToken({
      idToken: id_token,
      audience: privateConstants.GOOGLE_CLIENT_ID,
    });

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
