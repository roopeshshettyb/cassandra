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
   * Short-lived token letting the browser-agent worker act as the account that
   * requested a job, for the length of that one job.
   *
   * The worker drives a PMS through its web UI, so it needs a signed-in browser
   * session. Ours is OTP-only and a headless worker has no mailbox, so the
   * session is issued here rather than logged in for. This grants nothing new:
   * enqueue() already verified this account owns the hotel, so the worker only
   * exercises authority the requester demonstrably had. The short expiry is what
   * keeps it from becoming a standing credential sitting in a config file.
   */
  async generateAgentSessionToken(account: Account, expiresInSeconds: number): Promise<string> {
    const accountData = account.toJSON ? account.toJSON() : account;
    return this.jwtService.sign(
      {
        id: accountData.id,
        uuid: accountData.uuid,
        email: accountData.email,
        name: accountData.name,
        role: accountData.role,
        profilePicUrl: accountData.profilePicUrl,
        agentSession: true,
      },
      { expiresIn: expiresInSeconds },
    );
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
