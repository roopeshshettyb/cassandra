import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConstantsService } from '../common/constants/constants.service';

// Guards the routes the Python browser worker calls. Deliberately separate from
// both JwtAuthGuard (a human session) and IntegrationAuthGuard (a PMS pushing in):
// this is our own worker pulling work out, and it must never be reachable with a
// guest or integration credential.
@Injectable()
export class AgentWorkerGuard implements CanActivate {
  constructor(private readonly constantsService: ConstantsService) {}

  canActivate(context: ExecutionContext): boolean {
    const config = this.constantsService.private.AGENT_JOBS;

    // No secret configured means the worker routes stay shut rather than open.
    if (!config.WORKER_SECRET) {
      throw new UnauthorizedException(config.ERROR_INVALID_WORKER_SECRET);
    }

    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers?.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException(config.ERROR_INVALID_WORKER_SECRET);
    }

    const presented = header.slice('Bearer '.length).trim();
    if (!presented || presented !== config.WORKER_SECRET) {
      throw new UnauthorizedException(config.ERROR_INVALID_WORKER_SECRET);
    }

    return true;
  }
}
