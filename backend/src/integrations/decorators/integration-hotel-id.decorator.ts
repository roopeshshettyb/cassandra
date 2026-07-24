import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Set by IntegrationAuthGuard after resolving the Bearer token to a hotel.
export const CurrentIntegrationHotelId = createParamDecorator((data: unknown, ctx: ExecutionContext): number => {
  const request = ctx.switchToHttp().getRequest();
  return request.integrationHotelId;
});
