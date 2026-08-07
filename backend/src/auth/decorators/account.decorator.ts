import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Account } from '../../accounts/accounts.model';

export const CurrentAccount = createParamDecorator((data: unknown, ctx: ExecutionContext): Account | undefined => {
  const request = ctx.switchToHttp().getRequest();
  return request.account;
});
