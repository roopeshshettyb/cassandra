import { OAuthService } from '../../../src/oauth/oauth.service';
import { EmailService } from '../../../src/oauth/email/email.service';
import { GoogleService } from '../../../src/oauth/google/google.service';
import { XService } from '../../../src/oauth/x/x.service';
import { mock, constants } from '../helpers';

describe('OAuthService', () => {
  let accountsService: any, google: any, x: any, email: any;
  let service: OAuthService;
  const saved = { id: 1, uuid: 'email:a@x', oauthMeta: { secret: 1 }, toJSON: () => ({ id: 1, uuid: 'email:a@x', oauthMeta: { secret: 1 }, email: 'a@x' }) };

  beforeEach(() => {
    accountsService = mock({ upsert: jest.fn(async () => [saved]) });
    google = mock({ handleCallback: jest.fn(async () => ({ uuid: 'a@x', oauthMeta: { g: 1 }, email: 'a@x' })) });
    x = mock({ handleCallback: jest.fn(async () => ({ uuid: 'x1', oauthMeta: { x: 1 } })) });
    email = mock({ handleCallback: jest.fn(async () => ({ uuid: 'a@x', oauthMeta: {}, email: 'a@x' })) });
    service = new OAuthService(mock({ generateToken: jest.fn(async () => 'jwt') }), accountsService, google, x, email, constants);
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

  it('refuses linking to a missing account', async () => {
    accountsService.findByUuid.mockResolvedValue(null);
    await expect(service.handleCallback({ authType: 'x' }, { uuid: 'gone' })).rejects.toThrow('Account not found');
  });

  it('refuses when the linked account vanished during the update', async () => {
    accountsService.findByUuid.mockResolvedValue(saved);
    accountsService.update.mockResolvedValue([0, []]);
    await expect(service.handleCallback({ authType: 'x' }, { uuid: 'email:a@x' })).rejects.toThrow('Account not found after update');
  });
});

describe('EmailService', () => {
  let accountsService: any;
  let service: EmailService;
  const future = new Date(Date.now() + 60_000);

  beforeEach(() => {
    accountsService = mock();
    service = new EmailService(accountsService, mock({ buildOtpEmailHtml: jest.fn(() => '<p/>') }), constants);
  });

  it('accepts the right OTP once, then clears it', async () => {
    accountsService.findByUuid.mockResolvedValue({ otp: '123456', otpExpiresAt: future, name: 'A' });
    await expect(service.handleCallback({ email: 'A@x', otp: '123456' })).resolves.toMatchObject({ uuid: 'a@x', email: 'a@x', name: 'A' });
    expect(accountsService.update).toHaveBeenCalledWith({ otp: null, otpExpiresAt: null }, { uuid: 'email:a@x' });
  });

  it('refuses an expired OTP', async () => {
    accountsService.findByUuid.mockResolvedValue({ otp: '123456', otpExpiresAt: new Date(Date.now() - 1) });
    await expect(service.handleCallback({ email: 'a@x', otp: '123456' })).rejects.toThrow('OTP has expired');
    expect(accountsService.update).not.toHaveBeenCalled();
  });
});

// Provider sign-ins call Google and X, so only their refusals are tested here.
describe('GoogleService and XService', () => {
  it('Google refuses a callback without an id_token', async () => {
    await expect(new GoogleService(constants).handleCallback({})).rejects.toThrow('Missing id_token for Google OAuth');
  });

  it('X refuses a callback missing code, codeVerifier or redirectUri', async () => {
    await expect(new XService(constants, mock()).handleCallback({ code: 'c' })).rejects.toThrow('Missing code, codeVerifier, or redirectUri for X OAuth');
  });

  it('X refuses when it returns no user', async () => {
    const api = mock({ request: jest.fn(async () => ({ data: { access_token: 't' } })) });
    await expect(new XService(constants, api).handleCallback({ code: 'c', codeVerifier: 'v', redirectUri: 'r' })).rejects.toThrow('Failed to get X user data.');
  });
});
