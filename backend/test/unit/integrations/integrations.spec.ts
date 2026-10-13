import { BadRequestException, ForbiddenException, HttpStatus, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { HotelIntegrationsService } from '../../../src/integrations/hotel-integrations.service';
import { IntegrationStatus } from '../../../src/integrations/hotel-integrations.model';
import { IntegrationAuthGuard } from '../../../src/integrations/integration-auth.guard';
import { IntegrationsWebhookController } from '../../../src/integrations/integrations.webhook.controller';
import { CanonicalAdapter } from '../../../src/integrations/adapters/canonical.adapter';
import { AdapterRegistry } from '../../../src/integrations/adapters/adapter.registry';
import { mock, constants, owner, staff, row, loose } from '../helpers';

const I = constants.private.INTEGRATIONS;

describe('HotelIntegrationsService', () => {
  let integrations: any, hotelsService: any;
  let service: HotelIntegrationsService;
  const me = owner();

  beforeEach(() => {
    integrations = mock({ create: jest.fn(async (v: any) => ({ createdAt: 'now', ...v })) });
    hotelsService = mock();
    service = new HotelIntegrationsService(integrations, hotelsService, constants);
  });

  it('shows metadata, never the token', async () => {
    integrations.findOne.mockResolvedValue({ status: IntegrationStatus.ACTIVE, tokenPrefix: 'abcd1234', tokenHash: 'secret' });
    const res = await service.getMetadataForHotel(1, me);
    expect(res.data).toEqual({ status: IntegrationStatus.ACTIVE, tokenPrefix: 'abcd1234', createdAt: null, webhookUrls: expect.any(Object) });
    expect(JSON.stringify(res)).not.toContain('secret');
  });

  it('shows empty metadata before a token exists', async () => {
    integrations.findOne.mockResolvedValue(null);
    await expect(service.getMetadataForHotel(1, me)).resolves.toMatchObject({ data: { status: null, tokenPrefix: null } });
  });

  it('generates a token, storing only its hash', async () => {
    integrations.findOne.mockResolvedValue(null);
    const res = await service.generateOrRotateToken(1, me);
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

  it('rotates an existing token and reactivates it', async () => {
    const existing = row({ hotelId: 1, tokenHash: 'old', status: IntegrationStatus.REVOKED });
    integrations.findOne.mockResolvedValue(existing);
    const res = await service.generateOrRotateToken(1, me);
    expect(res.message).toBe(I.MSG_TOKEN_ROTATED);
    expect(existing.tokenHash).not.toBe('old');
    expect(existing.status).toBe(IntegrationStatus.ACTIVE);
  });

  it('revokes a token', async () => {
    const existing = row({ status: IntegrationStatus.ACTIVE });
    integrations.findOne.mockResolvedValue(existing);
    await expect(service.revokeToken(1, me)).resolves.toMatchObject({ message: I.MSG_TOKEN_REVOKED });
    expect(existing.status).toBe(IntegrationStatus.REVOKED);
  });

  it('revoke throws NotFound without a token', async () => {
    integrations.findOne.mockResolvedValue(null);
    await expect(service.revokeToken(1, me)).rejects.toThrow(NotFoundException);
  });

  it.each(['getMetadataForHotel', 'generateOrRotateToken', 'revokeToken'])('%s is refused to someone who cannot manage the hotel', async (method) => {
    hotelsService.ensureCanManageHotelSettings.mockRejectedValue(new ForbiddenException());
    await expect(loose(service)[method](1, staff())).rejects.toThrow(ForbiddenException);
    expect(integrations.findOne).not.toHaveBeenCalled();
  });

  it('resolves only an active token to its hotel', async () => {
    integrations.findOne.mockResolvedValue({ hotelId: 4 });
    await expect(service.resolveHotelIdFromToken('tok')).resolves.toBe(4);
    expect(integrations.findOne.mock.calls[0][0].where).toEqual({ tokenHash: createHash(I.TOKEN_HASH_ALGORITHM).update('tok').digest('hex'), status: IntegrationStatus.ACTIVE });
    integrations.findOne.mockResolvedValue(null);
    await expect(service.resolveHotelIdFromToken('bad')).resolves.toBeNull();
  });
});

describe('IntegrationAuthGuard', () => {
  const contextFor = (request: any): any => ({ switchToHttp: () => ({ getRequest: () => request }) });
  let integrationsService: any;
  let guard: IntegrationAuthGuard;

  beforeEach(() => {
    integrationsService = mock();
    guard = new IntegrationAuthGuard(integrationsService, constants);
  });

  it('pins the request to the token hotel', async () => {
    integrationsService.resolveHotelIdFromToken.mockResolvedValue(4);
    const request: any = { headers: { authorization: 'Bearer tok' } };
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.integrationHotelId).toBe(4);
  });

  it.each([[{}], [{ authorization: 'Basic x' }]])('refuses a missing or non-bearer header (%p)', async (headers) => {
    await expect(guard.canActivate(contextFor({ headers }))).rejects.toThrow(new UnauthorizedException(I.ERROR_INVALID_TOKEN));
  });

  it('refuses an unknown or revoked token', async () => {
    integrationsService.resolveHotelIdFromToken.mockResolvedValue(null);
    await expect(guard.canActivate(contextFor({ headers: { authorization: 'Bearer x' } }))).rejects.toThrow(new UnauthorizedException(I.ERROR_INVALID_TOKEN));
  });
});

describe('IntegrationsWebhookController', () => {
  let bookingsService: any, requestsService: any, res: any;
  let controller: IntegrationsWebhookController;

  beforeEach(() => {
    bookingsService = mock({ upsertByExternalId: jest.fn(async () => ({ record: { id: 1 }, created: true })) });
    requestsService = mock({ upsertByExternalId: jest.fn(async () => ({ record: { id: 2 }, created: false })) });
    res = { status: jest.fn() };
    controller = new IntegrationsWebhookController(bookingsService, requestsService, constants, new AdapterRegistry(new CanonicalAdapter(constants)));
  });

  it('answers 201 when a booking is created', async () => {
    await expect(controller.upsertBooking(loose({ externalId: 'b' }), 4, res)).resolves.toMatchObject({ message: I.MSG_BOOKING_UPSERTED, data: { id: 1 } });
    expect(bookingsService.upsertByExternalId).toHaveBeenCalledWith(4, { externalId: 'b' });
    expect(res.status).toHaveBeenCalledWith(HttpStatus.CREATED);
  });

  it('answers 200 when a request is updated', async () => {
    await expect(controller.upsertRequest(loose({ externalId: 'r' }), 4, res)).resolves.toMatchObject({ message: I.MSG_REQUEST_UPSERTED });
    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
  });

  it.each([
    ['booking', HttpStatus.CREATED],
    ['request', HttpStatus.OK],
  ])('routes a canonical %s', async (type, status) => {
    await controller.providerWebhook('canonical', { type, data: { externalId: 'x' } }, 4, res);
    const service = type === 'booking' ? bookingsService : requestsService;
    expect(service.upsertByExternalId).toHaveBeenCalledWith(4, { externalId: 'x' });
    expect(res.status).toHaveBeenCalledWith(status);
  });

  it('throws NotFound for an unknown provider', async () => {
    await expect(controller.providerWebhook('mews', {}, 4, res)).rejects.toThrow(new NotFoundException(I.ERROR_UNKNOWN_PROVIDER));
  });

  it.each([[null], [{ type: 'other', data: {} }], [{ type: 'booking' }]])('refuses a malformed canonical body (%p)', async (body) => {
    await expect(controller.providerWebhook('canonical', body, 4, res)).rejects.toThrow(new BadRequestException(I.ERROR_MALFORMED_CANONICAL_BODY));
  });

  it('passes an upsert refusal through', async () => {
    bookingsService.upsertByExternalId.mockRejectedValue(new BadRequestException('x'));
    await expect(controller.upsertBooking(loose({}), 4, res)).rejects.toThrow(BadRequestException);
  });
});
