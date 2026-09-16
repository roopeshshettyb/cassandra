import { ChatSession } from '../chat/gateway/chat-session.interface';

/** What a connected reservation client carries before a chat row exists. */
export interface ReservationContext {
  hotelId: number;
  publicHotel: Record<string, unknown> | null;
}

/**
 * Shared by both public reservation gateways — the text one and the voice one.
 * They differ in how a turn is driven, not in how a caller is identified or how
 * a session is shaped, so those answers live here once.
 */

/** Caller's address, preferring the proxy header the load balancer sets. */
export function getClientIp(client: any): string {
  const forwarded = client.handshake?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return client.handshake?.address ?? '';
}

/**
 * Hotel id from the handshake, or null. Deliberately strict: a repeated query
 * param arrives as an array, and parseInt would read "1 OR 1=1" or "1abc" as
 * hotel 1. Nothing good comes of guessing which hotel a malformed id meant.
 */
export function parseHotelId(raw: unknown): number | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    return null;
  }
  const value = String(raw).trim();
  if (!/^[0-9]+$/.test(value)) {
    return null;
  }
  const hotelId = Number(value);
  return hotelId > 0 ? hotelId : null;
}

/**
 * A reservation session: no account by design, scoped to a hotel rather than a
 * booking. The absent account is what routes the turn to the reservation prompt
 * and its read-only tools.
 */
export function buildReservationSession(
  context: ReservationContext,
  chatId: number,
  languageCode: string | null,
): ChatSession {
  return {
    account: null,
    bookingId: null,
    hotelId: context.hotelId,
    chatId,
    hotel: context.publicHotel,
    booking: null,
    languageCode,
  };
}

/**
 * Proper nouns worth biasing the caller's transcript towards. The property's
 * own name is the one word a speech model has certainly never seen, and it
 * tends to arrive in the first sentence — get it wrong and every answer after
 * it is answering the wrong question.
 */
export function buildSttKeyterms(context: ReservationContext, extra: string[]): string[] {
  const hotel: any = context.publicHotel ?? {};
  const terms = [hotel.name, hotel.brandName, ...extra]
    .map((term) => (typeof term === 'string' ? term.trim() : ''))
    .filter((term) => term.length > 0);
  return Array.from(new Set(terms));
}
