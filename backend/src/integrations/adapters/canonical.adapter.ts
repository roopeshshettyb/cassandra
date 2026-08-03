import { BadRequestException, Injectable } from '@nestjs/common';
import { IntegrationProviderAdapter, CanonicalUpsertItem } from './adapter.interface';
import { ConstantsService } from '../../common/constants/constants.service';

// Body is already in our own canonical shape: { type: 'booking' | 'request', data: {...} }.
// This is the identity/reference adapter — future PMS adapters (Mews, Cloudbeds,
// etc.) parse their own webhook payload shape into the same CanonicalUpsertItem[].
@Injectable()
export class CanonicalAdapter implements IntegrationProviderAdapter {
  constructor(private readonly constantsService: ConstantsService) {}

  verify(): void {
    // Bearer integration token already verified by IntegrationAuthGuard.
  }

  parse(body: any): CanonicalUpsertItem[] {
    if (!body || (body.type !== 'booking' && body.type !== 'request') || !body.data) {
      throw new BadRequestException(this.constantsService.private.INTEGRATIONS.ERROR_MALFORMED_CANONICAL_BODY);
    }
    return [{ type: body.type, payload: body.data }];
  }
}
