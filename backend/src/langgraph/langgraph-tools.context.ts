import { Account } from '../accounts/accounts.model';

export interface AgentToolContext {
  account: Account;
  bookingId: number | null;
  chatId: number;
  hotel: Record<string, unknown> | null;
  booking: Record<string, unknown> | null;
  languageCode?: string | null;
  // AllRounder-specific: hotel IDs this account can access (null = admin = all)
  scopedHotelIds?: number[] | null;
  // AllRounder-specific: pre-built hotel context string for prompt
  hotelContext?: string | null;
}
