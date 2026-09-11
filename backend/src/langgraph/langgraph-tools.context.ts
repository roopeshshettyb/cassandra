import { Account } from '../accounts/accounts.model';

export interface AgentToolContext {
  /** Null on the public reservation agent, which runs without an account. */
  account: Account | null;
  /** Set on reservation sessions to scope every tool to that one hotel. */
  hotelId?: number | null;
  bookingId: number | null;
  chatId: number;
  hotel: Record<string, unknown> | null;
  booking: Record<string, unknown> | null;
   languageCode?: string | null;
}
