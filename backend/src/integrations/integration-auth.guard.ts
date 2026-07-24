import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { HotelIntegrationsService } from './hotel-integrations.service';
import { ConstantsService } from '../common/constants/constants.service';

declare global {
  namespace Express {
    interface Request {
      integrationHotelId?: number;
    }
  }
}

// Guards the inbound webhook routes only (integrations.webhook.controller.ts).
// Hotel identity comes ENTIRELY from the token — any hotelId a caller might
// otherwise supply in the request body is ignored by the upsert services.
@Injectable()
export class IntegrationAuthGuard implements CanActivate {
  constructor(
    private readonly hotelIntegrationsService: HotelIntegrationsService,
    private readonly constantsService: ConstantsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers?.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(this.constantsService.private.INTEGRATIONS.ERROR_INVALID_TOKEN);
    }

    const token = authHeader.slice(7);
    const hotelId = await this.hotelIntegrationsService.resolveHotelIdFromToken(token);
    if (!hotelId) {
      throw new UnauthorizedException(this.constantsService.private.INTEGRATIONS.ERROR_INVALID_TOKEN);
    }

    request.integrationHotelId = hotelId;
    return true;
  }
}
