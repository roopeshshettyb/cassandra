import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Account } from '../accounts/accounts.model';
import { ConstantsService } from '../common/constants/constants.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private constantsService: ConstantsService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: constantsService.private.JWT_SECRET,
    });
  }

  async validate(payload: any): Promise<Account> {
    return payload as Account;
  }
}
