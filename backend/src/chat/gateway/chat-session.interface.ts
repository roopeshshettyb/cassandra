import { Account } from '../../accounts/accounts.model';

export interface ChatSession {
  account: Account;
  bookingId: number | null;
  chatId: number;
  /** Pre-fetched at connection */
  hotel: any;
  booking: any;
  languageCode?: string | null;
}
