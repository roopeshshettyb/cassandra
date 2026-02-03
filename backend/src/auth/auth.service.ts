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
}
