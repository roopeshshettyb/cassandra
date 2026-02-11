import { Account } from '../../accounts/accounts.model';

export interface ChatSession {
  account: Account;
  bookingId: number;
  chatId: number;
  /** Pre-fetched at connection */
  hotel: any;
  booking: any;
}
