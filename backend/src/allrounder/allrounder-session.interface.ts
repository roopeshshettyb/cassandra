import { Account } from '../accounts/accounts.model';

export interface AllRounderSession {
  account: Account;
  scopedHotelIds: number[] | null;
  chatId: number;
  hotelContext: string;
  languageCode: string | null;
}
