import { ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../../../src/auth/auth.service';
import { InviteController } from '../../../src/auth/invite.controller';
import { AdminGuard } from '../../../src/auth/guards/admin.guard';
import { JwtMiddleware } from '../../../src/auth/jwt.middleware';
import { JwtStrategy } from '../../../src/auth/jwt.strategy';
import { HotelAccount } from '../../../src/hotels/hotel-accounts.model';
import { HOTEL_MEMBER_INVITE_TYPE_STAFF, HotelMemberStatus } from '../../../src/common/constants/constants.service';
import { mock, constants, admin, owner, staff, guest, row, loose } from '../helpers';

const jwt = new JwtService({ secret: 'unit-secret', signOptions: { expiresIn: '1h' } });

describe('AuthService', () => {
  const service = new AuthService(jwt);
  const account = { id: 1, uuid: 'email:a@x', email: 'a@x', name: 'A', role: 'guest', organisationId: undefined };

  it('signs a session token carrying organisationId, null when absent', async () => {
    const token = await service.generateToken(loose({ toJSON: () => account }));
    await expect(service.verifyToken(token)).resolves.toMatchObject({ id: 1, role: 'guest', organisationId: null });
  });

  it('signs an invite token with its extra payload', async () => {
    const token = await service.generateInviteToken(loose(account), { hotelId: 3, type: 'staff' });
    await expect(service.verifyToken(token)).resolves.toMatchObject({ invite: true, hotelId: 3, type: 'staff' });
  });

  it('expires an invite token at the given time', async () => {
    const token = await service.generateInviteToken(loose(account), {}, new Date(Date.now() + 60_000));
    const { exp } = loose(jwt.decode(token));
    expect(exp).toBeGreaterThan(Date.now() / 1000 + 50);
    expect(exp).toBeLessThan(Date.now() / 1000 + 70);
  });

  it.each([
    ['garbage', 'not-a-token'],
    ['wrong secret', new JwtService({ secret: 'other' }).sign({ id: 1 })],
  ])('rejects a %s token as null', async (_name, token) => {
    await expect(service.verifyToken(token)).resolves.toBeNull();
  });
});

describe('InviteController', () => {
  let authService: any, accountsService: any;
  let controller: InviteController;
  const invited = { id: 5, uuid: 'email:s@x', email: 's@x', name: 'S', role: 'hotel_staff' };

  beforeEach(() => {
    authService = mock({ generateToken: jest.fn(async () => 'session') });
    accountsService = mock({ findOne: jest.fn(async () => invited) });
    controller = new InviteController(authService, accountsService);
  });

  afterEach(() => jest.restoreAllMocks());

  const rejects = async (body: any, status: number, message: string) => {
    const error: HttpException = await controller.exchangeInvite(body).catch((e) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(status);
    expect(error.getResponse()).toEqual({ success: false, message, data: null });
  };

  it('exchanges a guest invite for a session', async () => {
    authService.verifyToken.mockResolvedValue({ id: 5, invite: true, type: 'guest' });
    await expect(controller.exchangeInvite({ token: 't' })).resolves.toMatchObject({ success: true, token: 'session', account: { id: 5, email: 's@x' } });
  });

  it('activates the membership named by a staff invite', async () => {
    const membership = row({ status: HotelMemberStatus.PENDING });
    jest.spyOn(HotelAccount, 'findOne').mockResolvedValue(membership);
    authService.verifyToken.mockResolvedValue({ id: 5, invite: true, type: HOTEL_MEMBER_INVITE_TYPE_STAFF, hotelId: 2 });
    await controller.exchangeInvite({ token: 't' });
    expect(HotelAccount.findOne).toHaveBeenCalledWith({ where: { hotelId: 2, accountId: 5 } });
    expect(membership.status).toBe(HotelMemberStatus.ACTIVE);
  });

  it('requires a token', async () => {
    await rejects({}, HttpStatus.BAD_REQUEST, 'Invite token is required');
  });

  it.each([[null], [{ id: 5 }]])('refuses an invalid, expired or non-invite token (%p)', async (decoded) => {
    authService.verifyToken.mockResolvedValue(decoded);
    await rejects({ token: 't' }, HttpStatus.UNAUTHORIZED, 'Invite link is invalid or has expired');
  });

  it('refuses an invite for an account that no longer exists', async () => {
    authService.verifyToken.mockResolvedValue({ id: 5, invite: true });
    accountsService.findOne.mockResolvedValue(null);
    await rejects({ token: 't' }, HttpStatus.UNAUTHORIZED, 'Invite link is invalid or has expired');
  });
});

describe('AdminGuard', () => {
  const guard = new AdminGuard();
  const contextFor = (account: any): any => ({ switchToHttp: () => ({ getRequest: () => ({ account }) }) });

  it('lets an admin through', () => {
    expect(guard.canActivate(contextFor(admin()))).toBe(true);
  });

  it.each([
    ['owner', owner()],
    ['staff', staff()],
    ['guest', guest()],
    ['nobody', undefined],
  ])('refuses %s', (_name, account) => {
    expect(() => guard.canActivate(contextFor(account))).toThrow(ForbiddenException);
  });
});

describe('JwtMiddleware', () => {
  it('attaches the account of a valid bearer token, and nothing otherwise', async () => {
    const authService: any = mock({ verifyToken: jest.fn(async (t: string) => (t === 'good' ? { id: 1 } : null)) });
    const middleware = new JwtMiddleware(authService);
    for (const [authorization, expected] of [
      ['Bearer good', { id: 1 }],
      ['Bearer bad', undefined],
      ['good', undefined],
      [undefined, undefined],
    ]) {
      const req: any = { headers: { authorization } };
      const next = jest.fn();
      await middleware.use(req, loose({}), next);
      expect(req.account).toEqual(expected);
      expect(next).toHaveBeenCalled();
    }
  });
});

describe('JwtStrategy', () => {
  it('uses the token payload as the account', async () => {
    await expect(new JwtStrategy(constants).validate({ id: 1, role: 'guest' })).resolves.toEqual({ id: 1, role: 'guest' });
  });
});
