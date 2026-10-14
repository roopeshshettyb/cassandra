import { HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../../../src/auth/auth.service';
import { InviteController } from '../../../src/auth/invite.controller';
import { mock, loose } from '../helpers';

const jwt = new JwtService({ secret: 'unit-secret', signOptions: { expiresIn: '1h' } });

describe('AuthService', () => {
  const service = new AuthService(jwt);
  const account = { id: 1, uuid: 'email:a@x', email: 'a@x', name: 'A', role: 'guest', organisationId: undefined };

  it('expires an invite token at the given time', async () => {
    const token = await service.generateInviteToken(loose(account), {}, new Date(Date.now() + 60_000));
    const { exp } = loose(jwt.decode(token));
    expect(exp).toBeGreaterThan(Date.now() / 1000 + 50);
    expect(exp).toBeLessThan(Date.now() / 1000 + 70);
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
