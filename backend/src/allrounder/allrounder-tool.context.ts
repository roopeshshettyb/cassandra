import { Account } from '../accounts/accounts.model';

export interface AllRounderToolContext {
  account: Account;
  scopedHotelIds: number[] | null;
}

export interface AgentCard {
  type: 'request' | 'booking' | 'stat' | 'hotel';
  title: string;
  subtitle?: string;
  badge?: string;
  route?: string;
  meta?: Record<string, unknown>;
}
