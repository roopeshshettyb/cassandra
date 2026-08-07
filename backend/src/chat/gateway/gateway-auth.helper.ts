import { ChatSession } from './chat-session.interface';
import { ensureWithinStayWindow } from './stay-window.guard';

export interface GatewayAuthDeps {
  authService: { verifyToken: (token: string) => Promise<any> };
  chatService: {
    findOrCreateForBooking: (bookingId: number, account: any) => Promise<any>;
    findOrCreateGeneralForAccount: (account: any) => Promise<any>;
    findByIdForSessionScope: (account: any, chatId: number, bookingId: number | null) => Promise<any>;
  };
  bookingsService: { findByIdForAccount: (bookingId: number, account: any) => Promise<{ data: any }> };
  constantsService: { public: { ERROR_CHAT_ONLY_DURING_STAY: string } };
}

/**
 * Parse token and bookingId from Socket handshake (query or auth).
 */
export function parseConnectionHandshake(client: any): { token: string | null; bookingId: number | undefined; chatId: number | undefined } {
  const auth: any = client.handshake?.auth;
  const token = client.handshake?.query?.token || (auth?.token ?? null);
  const bookingIdRaw = client.handshake?.query?.bookingId;
  const bookingId = bookingIdRaw ? parseInt(String(bookingIdRaw), 10) : undefined;
  const chatIdRaw = client.handshake?.query?.chatId ?? auth?.chatId;
  const chatId = chatIdRaw ? parseInt(String(chatIdRaw), 10) : undefined;
  return {
    token,
    bookingId: typeof bookingId === 'number' && !isNaN(bookingId) ? bookingId : undefined,
    chatId: typeof chatId === 'number' && !isNaN(chatId) ? chatId : undefined,
  };
}

/**
 * Authenticate client with token and optional bookingId, enforce stay window when booking is present, attach session.
 * On success calls onSuccess(session). On failure emits error and disconnects.
 */
export async function authenticateAndInit(
  client: any,
  token: string,
  bookingId: number | undefined,
  chatId: number | undefined,
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

    let chat: any;
    let sessionBookingId: number | null = null;
    let booking: any = null;
    let hotel: any = null;

    if (typeof bookingId === 'number') {
      chat = await deps.chatService.findOrCreateForBooking(bookingId, account);
      const bookingResult = await deps.bookingsService.findByIdForAccount(bookingId, account);
      booking = bookingResult?.data ?? null;
      if (!ensureWithinStayWindow(client, booking.isWithinStay, deps.constantsService.public.ERROR_CHAT_ONLY_DURING_STAY)) {
        return;
      }
      hotel = booking?.hotel || null;
      sessionBookingId = bookingId;
    } else {
      chat = await deps.chatService.findOrCreateGeneralForAccount(account);
    }

    // If the client requested a specific chat, use it when it belongs to this
    // account + booking scope. Otherwise fall back to the resolved default.
    if (typeof chatId === 'number') {
      const scopedChat = await deps.chatService.findByIdForSessionScope(account, chatId, sessionBookingId);
      if (scopedChat) {
        chat = scopedChat;
      }
    }

    const session: ChatSession = {
      account,
      bookingId: sessionBookingId,
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
