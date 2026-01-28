import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { Account } from '../accounts/accounts.model';

declare global {
  namespace Express {
    interface Request {
      account?: Account;
    }
  }
}

@Injectable()
export class JwtMiddleware implements NestMiddleware {
  constructor(private authService: AuthService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const account = await this.authService.verifyToken(token);
      if (account) {
        req.account = account;
      }
    }

    next();
  }
}

