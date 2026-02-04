import { Account } from '../../accounts/accounts.model';

export interface ChatSession {
  account: Account;
  bookingId: number;
  chatId: number;
  /** Pre-fetched at connection */
  hotel: Record<string, unknown> | null;
  booking: Record<string, unknown> | null;
}
