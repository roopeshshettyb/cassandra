import { ChatSession } from './chat-session.interface';
import { ensureWithinStayWindow } from './stay-window.guard';

export interface GatewayAuthDeps {
  authService: { verifyToken: (token: string) => Promise<any> };
  chatService: { findOrCreateForBooking: (bookingId: number, account: any) => Promise<any> };
  bookingsService: { findByIdForAccount: (bookingId: number, account: any) => Promise<{ data: any }> };
  constantsService: { public: { ERROR_CHAT_ONLY_DURING_STAY: string } };
}

/**
 * Parse token and bookingId from Socket handshake (query or auth).
 */
export function parseConnectionHandshake(client: any): { token: string | null; bookingId: number | undefined } {
  const auth: any = client.handshake?.auth;
  const token = client.handshake?.query?.token || (auth?.token ?? null);
  const bookingIdRaw = client.handshake?.query?.bookingId;
  const bookingId = bookingIdRaw ? parseInt(String(bookingIdRaw), 10) : undefined;
  return { token, bookingId: typeof bookingId === 'number' && !isNaN(bookingId) ? bookingId : undefined };
}

/**
 * Authenticate client with token and bookingId, enforce stay window, attach session.
 * On success calls onSuccess(session). On failure emits error and disconnects.
 */
export async function authenticateBookingAndInit(
  client: any,
  token: string,
  bookingId: number,
  deps: GatewayAuthDeps,
  onSuccess: (session: ChatSession) => Promise<void>,
): Promise<void> {
  try {
    const account = await deps.authService.verifyToken(token);
    if (!account) {
      client.emit('error', { code: 'UNAUTHORIZED', message: 'Invalid token' });
      client.disconnect(true);
      return;
    }

    const chat = await deps.chatService.findOrCreateForBooking(bookingId, account);
    const { data: booking } = await deps.bookingsService.findByIdForAccount(bookingId, account);
    if (!ensureWithinStayWindow(client, booking.isWithinStay, deps.constantsService.public.ERROR_CHAT_ONLY_DURING_STAY)) {
      return;
    }

    const hotel = booking.hotel || null;
    const session: ChatSession = {
      account,
      bookingId,
      chatId: chat.id,
      hotel,
      booking,
      languageCode: chat.languageCode ?? null,
    };
    client.session = session;
    delete client.sessionPending;
    await onSuccess(session);
  } catch (err: any) {
    if (err?.statusCode === 403 || err?.message?.includes('Forbidden')) {
      client.emit('error', { code: 'FORBIDDEN', message: 'No access to this booking' });
    } else {
      client.emit('error', { code: 'ERROR', message: err?.message || 'Setup failed' });
    }
    client.disconnect(true);
  }
}
