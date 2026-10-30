import { Account } from '../../accounts/accounts.model';

export interface ChatSession {
  /** Null on reservation sessions, which are unauthenticated by design. */
  account: Account | null;
  bookingId: number | null;
  /** Set on reservation sessions, which are scoped to a hotel not a booking. */
  hotelId?: number | null;
  chatId: number;
  /** Pre-fetched at connection */
  hotel: any;
  booking: any;
  languageCode?: string | null;
}
