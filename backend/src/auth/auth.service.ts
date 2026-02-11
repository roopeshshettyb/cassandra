import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Account } from '../accounts/accounts.model';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async generateToken(account: Account): Promise<string> {
    const accountData = account.toJSON();
    return this.jwtService.sign({
      id: accountData.id,
      uuid: accountData.uuid,
      email: accountData.email,
      name: accountData.name,
      role: accountData.role,
      profilePicUrl: accountData.profilePicUrl,
    });
  }

  async verifyToken(token: string): Promise<Account | null> {
    try {
      const decoded = this.jwtService.verify(token);
      return decoded as Account;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generates a 1-hour invite token for guest/staff invites.
   * Overrides the default JWT expiry so invite links always expire in 1 hour.
   */
  async generateInviteToken(account: Account, extraPayload?: Record<string, any>): Promise<string> {
    const accountData = account.toJSON ? account.toJSON() : account;
    const payload = {
      id: accountData.id,
      uuid: accountData.uuid,
      email: accountData.email,
      name: accountData.name,
      role: accountData.role,
      profilePicUrl: accountData.profilePicUrl,
      invite: true,
      ...(extraPayload || {}),
    };
    return this.jwtService.sign(payload, { expiresIn: '1h' });
  }
}
