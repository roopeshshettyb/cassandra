import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AccountRole } from '../../accounts/accounts.model';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const account = request.account;

    if (!account || account.role !== AccountRole.ADMIN) {
      throw new ForbiddenException();
    }

    return true;
  }
}
