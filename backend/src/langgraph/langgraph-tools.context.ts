import { Account } from '../accounts/accounts.model';

export interface AgentToolContext {
  account: Account;
  bookingId: number | null;
  chatId: number;
  hotel: Record<string, unknown> | null;
  booking: Record<string, unknown> | null;
   languageCode?: string | null;
}
