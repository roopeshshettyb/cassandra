import { Hotel } from './hotels.model';
import { HotelAccount } from './hotel-accounts.model';

export const HOTELS_REPOSITORY = 'HOTELS_REPOSITORY';
export const HOTEL_ACCOUNTS_REPOSITORY = 'HOTEL_ACCOUNTS_REPOSITORY';

export const HotelsRepository = {
  provide: HOTELS_REPOSITORY,
  useValue: Hotel,
};

export const HotelAccountsRepository = {
  provide: HOTEL_ACCOUNTS_REPOSITORY,
  useValue: HotelAccount,
};
