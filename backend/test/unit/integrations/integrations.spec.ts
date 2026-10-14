import { HttpStatus } from '@nestjs/common';
import { createHash } from 'crypto';
import { HotelIntegrationsService } from '../../../src/integrations/hotel-integrations.service';
import { IntegrationStatus } from '../../../src/integrations/hotel-integrations.model';
import { IntegrationsWebhookController } from '../../../src/integrations/integrations.webhook.controller';
import { CanonicalAdapter } from '../../../src/integrations/adapters/canonical.adapter';
import { AdapterRegistry } from '../../../src/integrations/adapters/adapter.registry';
import { mock, constants, owner } from '../helpers';

const I = constants.private.INTEGRATIONS;

describe('HotelIntegrationsService', () => {
  let integrations: any;
  let service: HotelIntegrationsService;

  beforeEach(() => {
    integrations = mock({ create: jest.fn(async (v: any) => ({ createdAt: 'now', ...v })) });
    service = new HotelIntegrationsService(integrations, mock(), constants);
  });

  it('generates a token, storing only its hash', async () => {
    integrations.findOne.mockResolvedValue(null);
    const res = await service.generateOrRotateToken(1, owner());
    const token = res.data.token;
    expect(token).toHaveLength(I.TOKEN_BYTE_LENGTH * 2);
    expect(res.message).toBe(I.MSG_TOKEN_GENERATED);
    expect(integrations.create).toHaveBeenCalledWith(
      expect.objectContaining({
        hotelId: 1,
        tokenHash: createHash(I.TOKEN_HASH_ALGORITHM).update(token).digest('hex'),
        tokenPrefix: token.slice(0, I.TOKEN_PREFIX_LENGTH),
        status: IntegrationStatus.ACTIVE,
      }),
    );
  });
});

describe('IntegrationsWebhookController', () => {
  let bookingsService: any, requestsService: any, res: any;
  let controller: IntegrationsWebhookController;

  beforeEach(() => {
    bookingsService = mock();
    requestsService = mock({ upsertByExternalId: jest.fn(async () => ({ record: { id: 2 }, created: false })) });
    res = { status: jest.fn() };
    controller = new IntegrationsWebhookController(bookingsService, requestsService, constants, new AdapterRegistry(new CanonicalAdapter(constants)));
  });

  // The API tests send a canonical booking; this is the request branch.
  it('routes a canonical request to the requests service, answering 200 for an update', async () => {
    await controller.providerWebhook('canonical', { type: 'request', data: { externalId: 'x' } }, 4, res);
    expect(requestsService.upsertByExternalId).toHaveBeenCalledWith(4, { externalId: 'x' });
    expect(bookingsService.upsertByExternalId).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
  });
});
