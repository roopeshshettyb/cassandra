import { Injectable } from '@nestjs/common';
import { AuthType } from '../../accounts/accounts.model';
import { ConstantsService } from '../../common/constants/constants.service';
import { ApiService } from '../../common/api/api.service';

@Injectable()
export class XService {
  constructor(private constantsService: ConstantsService, private apiService: ApiService) {}

  async handleCallback(body: any): Promise<{
    uuid: string;
    oauthMeta: any;
    email: string;
    name: string;
    profilePicUrl: string;
    username: string;
    description: string;
  }> {
    const { code, codeVerifier, redirectUri } = body;
    if (!code || !codeVerifier || !redirectUri) {
      throw new Error('Missing code, codeVerifier, or redirectUri for X OAuth');
    }

    const privateConstants = this.constantsService.private;
    const publicConstants = this.constantsService.public;

    const tokenResponse = await this.apiService.request({
      method: 'POST',
      url: `${publicConstants.X_API_URL}/2/oauth2/token`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${privateConstants.X_CLIENT_ID}:${privateConstants.X_CLIENT_SECRET}`).toString('base64')}`,
      },
      data: {
        code,
        grant_type: 'authorization_code',
        client_id: privateConstants.X_CLIENT_ID,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      },
    });

    const accessToken = tokenResponse.data.access_token;

    const userResponse = await this.apiService.request({
      method: 'GET',
      url: `${publicConstants.X_API_URL}/2/users/me`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        'user.fields': 'description,profile_image_url,public_metrics,username,name',
      },
    });

    const userData = userResponse.data.data;
    if (!userData) {
      throw new Error('Failed to get X user data.');
    }

    const uuid = userData.id;
    const name = userData.name || '';
    const username = userData.username || '';
    const profilePicUrl = userData.profile_image_url || '';
    const description = userData.description || '';
    const followers = userData.public_metrics?.followers_count || 0;
    const following = userData.public_metrics?.following_count || 0;
    const tweetCount = userData.public_metrics?.tweet_count || 0;
    const listedCount = userData.public_metrics?.listed_count || 0;

    const oauthMeta = {
      x: {
        accessToken,
        handle: username,
        bio: description,
        followers,
        following,
        tweetCount,
        listedCount,
      },
    };

    return {
      uuid,
      oauthMeta,
      email: '',
      name: name || username,
      profilePicUrl,
      username,
      description,
    };
  }
}
