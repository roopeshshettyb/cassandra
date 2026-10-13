import { OAuthService } from '../../../src/oauth/oauth.service';
import { OAuthController } from '../../../src/oauth/oauth.controller';
import { EmailService } from '../../../src/oauth/email/email.service';
import { OTP_LENGTH } from '../../../src/common/constants/constants.service';
import { mock, constants, loose } from '../helpers';

// These failures are plain Errors today, so the API answers 500 — see test/README.md.
describe('OAuthService', () => {
  let authService: any, accountsService: any, google: any, x: any, email: any;
  let service: OAuthService;
  const saved = { id: 1, uuid: 'email:a@x', oauthMeta: { secret: 1 }, toJSON: () => ({ id: 1, uuid: 'email:a@x', oauthMeta: { secret: 1 }, email: 'a@x' }) };

  beforeEach(() => {
    authService = mock({ generateToken: jest.fn(async () => 'jwt') });
    accountsService = mock({ upsert: jest.fn(async () => [saved]) });
    google = mock({ handleCallback: jest.fn(async () => ({ uuid: 'a@x', oauthMeta: { g: 1 }, email: 'a@x' })) });
    x = mock({ handleCallback: jest.fn(async () => ({ uuid: 'x1', oauthMeta: { x: 1 } })) });
    email = mock({ handleCallback: jest.fn(async () => ({ uuid: 'a@x', oauthMeta: {}, email: 'a@x' })) });
    service = new OAuthService(authService, accountsService, google, x, email, constants);
  });

  it('signs in by email and strips private fields from the response', async () => {
    const res = await service.handleCallback({ authType: 'email' });
    expect(accountsService.upsert).toHaveBeenCalledWith(expect.objectContaining({ uuid: 'email:a@x' }));
    expect(res).toEqual({ account: { id: 1, email: 'a@x' }, token: 'jwt' });
  });

  it('files a Google sign-in under the email account', async () => {
    await service.handleCallback({ authType: 'google' });
    expect(accountsService.upsert.mock.calls[0][0].uuid).toBe('email:a@x');
  });

  it('links a provider to the signed-in account by merging its metadata', async () => {
    accountsService.findByUuid.mockResolvedValue(saved);
    accountsService.update.mockResolvedValue([1, [saved]]);
    await service.handleCallback({ authType: 'x' }, { uuid: 'email:a@x' });
    expect(accountsService.update).toHaveBeenCalledWith({ oauthMeta: { secret: 1, x: 1 } }, { uuid: 'email:a@x' });
  });

  it('refuses an unknown auth type', async () => {
    await expect(service.handleCallback({ authType: 'myspace' })).rejects.toThrow('Unsupported auth type: myspace');
  });

  it('refuses linking to a missing account', async () => {
    accountsService.findByUuid.mockResolvedValue(null);
    await expect(service.handleCallback({ authType: 'x' }, { uuid: 'gone' })).rejects.toThrow('Account not found');
  });

  it('refuses when the linked account vanished during the update', async () => {
    accountsService.findByUuid.mockResolvedValue(saved);
    accountsService.update.mockResolvedValue([0, []]);
    await expect(service.handleCallback({ authType: 'x' }, { uuid: 'email:a@x' })).rejects.toThrow('Account not found after update');
  });

  it('passes a provider failure through', async () => {
    email.handleCallback.mockRejectedValue(new Error('Invalid email or OTP'));
    await expect(service.handleCallback({ authType: 'email' })).rejects.toThrow('Invalid email or OTP');
  });
});

describe('EmailService', () => {
  let accountsService: any, mailer: any;
  let service: EmailService;
  const future = new Date(Date.now() + 60_000);

  beforeEach(() => {
    accountsService = mock();
    mailer = mock({ buildOtpEmailHtml: jest.fn(() => '<p/>') });
    service = new EmailService(accountsService, mailer, constants);
  });

  describe('sendOtp', () => {
    it('creates the account on first use, stores an expiring OTP and emails it', async () => {
      accountsService.findByUuid.mockResolvedValue(null);
      accountsService.upsert.mockResolvedValue([{ id: 1 }]);
      await service.sendOtp('  A@X.com ');
      expect(accountsService.upsert).toHaveBeenCalledWith({ uuid: 'email:a@x.com', email: 'a@x.com', oauthMeta: {} });
      const [{ otp, otpExpiresAt }] = accountsService.update.mock.calls[0];
      expect(otp).toMatch(new RegExp(`^\\d{${OTP_LENGTH}}$`));
      expect(otpExpiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(mailer.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@x.com', text: expect.stringContaining(otp) }));
    });

    it('refuses a blank email', async () => {
      await expect(service.sendOtp('  ')).rejects.toThrow('Email is required');
    });
  });

  describe('handleCallback', () => {
    it('accepts the right OTP once, then clears it', async () => {
      accountsService.findByUuid.mockResolvedValue({ otp: '123456', otpExpiresAt: future, name: 'A' });
      await expect(service.handleCallback({ email: 'A@x', otp: '123456' })).resolves.toMatchObject({ uuid: 'a@x', email: 'a@x', name: 'A' });
      expect(accountsService.update).toHaveBeenCalledWith({ otp: null, otpExpiresAt: null }, { uuid: 'email:a@x' });
    });

    it.each([[{ otp: '1' }], [{ email: 'a@x' }]])('refuses a request missing email or otp (%p)', async (body) => {
      await expect(service.handleCallback(body)).rejects.toThrow('Missing email or otp for email auth');
    });

    it('refuses an unknown email and a wrong OTP alike', async () => {
      accountsService.findByUuid.mockResolvedValueOnce(null).mockResolvedValueOnce({ otp: '999999', otpExpiresAt: future });
      await expect(service.handleCallback({ email: 'a@x', otp: '123456' })).rejects.toThrow('Invalid email or OTP');
      await expect(service.handleCallback({ email: 'a@x', otp: '123456' })).rejects.toThrow('Invalid email or OTP');
    });

    it('refuses an expired OTP', async () => {
      accountsService.findByUuid.mockResolvedValue({ otp: '123456', otpExpiresAt: new Date(Date.now() - 1) });
      await expect(service.handleCallback({ email: 'a@x', otp: '123456' })).rejects.toThrow('OTP has expired');
      expect(accountsService.update).not.toHaveBeenCalled();
    });
  });
});

describe('OAuthController', () => {
  let oauth: any, email: any;
  let controller: OAuthController;

  beforeEach(() => {
    oauth = mock({ handleCallback: jest.fn(async () => ({ account: { id: 1 }, token: 'jwt' })) });
    email = mock();
    controller = new OAuthController(oauth, email);
  });

  it('returns the account and token', async () => {
    await expect(controller.callback({ authType: 'email' })).resolves.toEqual({ account: { id: 1 }, token: 'jwt' });
  });

  it('refuses a callback without authType', async () => {
    await expect(controller.callback({})).rejects.toThrow('Missing authType');
  });

  it('sends an OTP', async () => {
    await expect(controller.sendOtp({ email: 'a@x' })).resolves.toEqual({ success: true });
  });

  it.each([[{}], [{ email: 5 }]])('refuses send-otp without a string email (%p)', async (body) => {
    await expect(controller.sendOtp(loose(body))).rejects.toThrow('Email is required');
  });
});
