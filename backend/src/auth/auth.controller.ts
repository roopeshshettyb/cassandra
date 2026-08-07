import { Controller } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AccountsService } from '../accounts/accounts.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService, private accountsService: AccountsService) {}
}
