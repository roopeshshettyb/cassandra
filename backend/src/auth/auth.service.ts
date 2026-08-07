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
   * Generates an invite token for guest/staff invites.
   * When expiresAt is provided (e.g. checkout + 1 day for guest), uses that as exp; otherwise expires in 1 hour (e.g. staff invite).
   */
  async generateInviteToken(account: Account, extraPayload?: Record<string, any>, expiresAt?: Date): Promise<string> {
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
    const signOptions = expiresAt
      ? { expiresIn: Math.floor(expiresAt.getTime() / 1000) - Math.floor(Date.now() / 1000) }
      : { expiresIn: '1h' as const };
    return this.jwtService.sign(payload, signOptions);
  }
}
