import { parseConnectionHandshake, authenticateAndInit, GatewayAuthDeps } from '../../src/chat/gateway/gateway-auth.helper';
import { ensureWithinStayWindow } from '../../src/chat/gateway/stay-window.guard';

function fakeClient(handshake: any = {}) {
  return {
    handshake,
    emit: jest.fn(),
    disconnect: jest.fn(),
    session: undefined as any,
    sessionPending: true as any,
  };
}

describe('ensureWithinStayWindow', () => {
  it('passes through when inside the stay window', () => {
    const client = fakeClient();
    expect(ensureWithinStayWindow(client, true, 'nope')).toBe(true);
    expect(client.emit).not.toHaveBeenCalled();
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('emits OUTSIDE_STAY and force-disconnects when outside the window', () => {
    const client = fakeClient();
    expect(ensureWithinStayWindow(client, false, 'only during stay')).toBe(false);
    expect(client.emit).toHaveBeenCalledWith('error', { code: 'OUTSIDE_STAY', message: 'only during stay' });
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it.each([undefined, null, 0, ''])('rejects the falsy flag %p', (flag) => {
    const client = fakeClient();
    expect(ensureWithinStayWindow(client, flag, 'msg')).toBe(false);
  });
});

describe('parseConnectionHandshake', () => {
  it('reads token, bookingId and chatId from the query string', () => {
    const client = fakeClient({ query: { token: 't', bookingId: '12', chatId: '34' } });
    expect(parseConnectionHandshake(client)).toEqual({ token: 't', bookingId: 12, chatId: 34 });
  });

  it('falls back to the auth payload for token and chatId', () => {
    const client = fakeClient({ query: {}, auth: { token: 't', chatId: 9 } });
    expect(parseConnectionHandshake(client)).toEqual({ token: 't', bookingId: undefined, chatId: 9 });
  });

  it('prefers the query token over the auth token', () => {
    const client = fakeClient({ query: { token: 'from-query' }, auth: { token: 'from-auth' } });
    expect(parseConnectionHandshake(client).token).toBe('from-query');
  });

  it('returns a null token when the handshake is empty', () => {
    expect(parseConnectionHandshake(fakeClient())).toEqual({ token: null, bookingId: undefined, chatId: undefined });
  });

  it('drops ids that do not parse as numbers', () => {
    const client = fakeClient({ query: { token: 't', bookingId: 'abc', chatId: 'xyz' } });
    expect(parseConnectionHandshake(client)).toEqual({ token: 't', bookingId: undefined, chatId: undefined });
  });

  // Documents current behaviour: the raw guard is on the *string* being truthy, so
  // "0" survives and becomes the number 0 — which is never a real id downstream.
  it('lets a "0" id through as 0', () => {
    const client = fakeClient({ query: { token: 't', bookingId: '0', chatId: '0' } });
    expect(parseConnectionHandshake(client)).toEqual({ token: 't', bookingId: 0, chatId: 0 });
  });

  it('drops an empty-string id', () => {
    const client = fakeClient({ query: { token: 't', bookingId: '', chatId: '' } });
    expect(parseConnectionHandshake(client)).toEqual({ token: 't', bookingId: undefined, chatId: undefined });
  });

  it('takes the leading integer of a mixed value, as parseInt does', () => {
    const client = fakeClient({ query: { token: 't', bookingId: '12abc' } });
    expect(parseConnectionHandshake(client).bookingId).toBe(12);
  });
});

describe('authenticateAndInit', () => {
  const account = { id: 1, role: 'guest' };
  let deps: GatewayAuthDeps;
  let onSuccess: jest.Mock;

  beforeEach(() => {
    onSuccess = jest.fn().mockResolvedValue(undefined);
    deps = {
      authService: { verifyToken: jest.fn().mockResolvedValue(account) },
      chatService: {
        findOrCreateForBooking: jest.fn().mockResolvedValue({ id: 100, languageCode: 'en' }),
        findOrCreateGeneralForAccount: jest.fn().mockResolvedValue({ id: 200, languageCode: null }),
        findByIdForSessionScope: jest.fn().mockResolvedValue(null),
      },
      bookingsService: {
        findByIdForAccount: jest.fn().mockResolvedValue({ data: { isWithinStay: true, hotel: { id: 5 } } }),
      },
      constantsService: { public: { ERROR_CHAT_ONLY_DURING_STAY: 'only during stay' } },
    };
  });

  it('builds a booking-scoped session and clears sessionPending', async () => {
    const client = fakeClient();
    await authenticateAndInit(client, 'tok', 12, undefined, deps, onSuccess);

    expect(deps.chatService.findOrCreateForBooking).toHaveBeenCalledWith(12, account);
    expect(client.session).toEqual({
      account,
      bookingId: 12,
      chatId: 100,
      hotel: { id: 5 },
      booking: { isWithinStay: true, hotel: { id: 5 } },
      languageCode: 'en',
    });
    expect(client.sessionPending).toBeUndefined();
    expect(onSuccess).toHaveBeenCalledWith(client.session);
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('builds a general session with a null bookingId when no booking is given', async () => {
    const client = fakeClient();
    await authenticateAndInit(client, 'tok', undefined, undefined, deps, onSuccess);

    expect(deps.chatService.findOrCreateGeneralForAccount).toHaveBeenCalledWith(account);
    expect(deps.bookingsService.findByIdForAccount).not.toHaveBeenCalled();
    expect(client.session).toMatchObject({ bookingId: null, chatId: 200, hotel: null, booking: null, languageCode: null });
  });

  it('rejects an invalid token before touching any other service', async () => {
    (deps.authService.verifyToken as jest.Mock).mockResolvedValue(null);
    const client = fakeClient();

    await authenticateAndInit(client, 'bad', 12, undefined, deps, onSuccess);

    expect(client.emit).toHaveBeenCalledWith('error', { code: 'UNAUTHORIZED', message: 'Invalid token' });
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(deps.chatService.findOrCreateForBooking).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('refuses a connection outside the stay window', async () => {
    (deps.bookingsService.findByIdForAccount as jest.Mock).mockResolvedValue({ data: { isWithinStay: false } });
    const client = fakeClient();

    await authenticateAndInit(client, 'tok', 12, undefined, deps, onSuccess);

    expect(client.emit).toHaveBeenCalledWith('error', { code: 'OUTSIDE_STAY', message: 'only during stay' });
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.session).toBeUndefined();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('uses the requested chatId when it is in scope', async () => {
    (deps.chatService.findByIdForSessionScope as jest.Mock).mockResolvedValue({ id: 77, languageCode: 'hi' });
    const client = fakeClient();

    await authenticateAndInit(client, 'tok', 12, 77, deps, onSuccess);

    expect(deps.chatService.findByIdForSessionScope).toHaveBeenCalledWith(account, 77, 12);
    expect(client.session).toMatchObject({ chatId: 77, languageCode: 'hi' });
  });

  it('falls back to the default chat when the requested chatId is out of scope', async () => {
    const client = fakeClient();
    await authenticateAndInit(client, 'tok', 12, 999, deps, onSuccess);

    expect(client.session).toMatchObject({ chatId: 100 });
  });

  it('scopes the chatId lookup to a null booking for general sessions', async () => {
    const client = fakeClient();
    await authenticateAndInit(client, 'tok', undefined, 77, deps, onSuccess);

    expect(deps.chatService.findByIdForSessionScope).toHaveBeenCalledWith(account, 77, null);
  });

  it('maps a 403 from any dependency to FORBIDDEN', async () => {
    (deps.bookingsService.findByIdForAccount as jest.Mock).mockRejectedValue({ statusCode: 403 });
    const client = fakeClient();

    await authenticateAndInit(client, 'tok', 12, undefined, deps, onSuccess);

    expect(client.emit).toHaveBeenCalledWith('error', { code: 'FORBIDDEN', message: 'No access to this booking' });
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('maps a Forbidden message to FORBIDDEN', async () => {
    (deps.authService.verifyToken as jest.Mock).mockRejectedValue(new Error('Forbidden resource'));
    const client = fakeClient();

    await authenticateAndInit(client, 'tok', undefined, undefined, deps, onSuccess);

    expect(client.emit).toHaveBeenCalledWith('error', { code: 'FORBIDDEN', message: 'No access to this booking' });
  });

  it('surfaces any other failure as a generic ERROR', async () => {
    (deps.chatService.findOrCreateGeneralForAccount as jest.Mock).mockRejectedValue(new Error('db down'));
    const client = fakeClient();

    await authenticateAndInit(client, 'tok', undefined, undefined, deps, onSuccess);

    expect(client.emit).toHaveBeenCalledWith('error', { code: 'ERROR', message: 'db down' });
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('falls back to a default message when the error carries none', async () => {
    (deps.authService.verifyToken as jest.Mock).mockRejectedValue({});
    const client = fakeClient();

    await authenticateAndInit(client, 'tok', undefined, undefined, deps, onSuccess);

    expect(client.emit).toHaveBeenCalledWith('error', { code: 'ERROR', message: 'Setup failed' });
  });

  it('disconnects when onSuccess itself throws', async () => {
    onSuccess.mockRejectedValue(new Error('handler blew up'));
    const client = fakeClient();

    await authenticateAndInit(client, 'tok', undefined, undefined, deps, onSuccess);

    expect(client.emit).toHaveBeenCalledWith('error', { code: 'ERROR', message: 'handler blew up' });
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });
});
