import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AccountsService } from '../accounts/accounts.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService, private accountsService: AccountsService) {}

  // @Get('test-token/:accountId')
  // async getTestToken(@Param('accountId') accountId: string) {
  //   const account = await this.accountsService.findOne({ where: { id: parseInt(accountId, 10) } });
  //   if (!account) {
  //     throw new NotFoundException('Account not found');
  //   }
  //   const token = await this.authService.generateToken(account);
  //   return { token };
  // }
}
