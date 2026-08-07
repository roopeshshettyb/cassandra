import { Hotel } from './hotels.model';
import { HotelAccount } from './hotel-accounts.model';
import { HotelBrand } from './brands.model';

export const HOTELS_REPOSITORY = 'HOTELS_REPOSITORY';
export const HOTEL_ACCOUNTS_REPOSITORY = 'HOTEL_ACCOUNTS_REPOSITORY';
export const HOTEL_BRANDS_REPOSITORY = 'HOTEL_BRANDS_REPOSITORY';

export const HotelsRepository = {
  provide: HOTELS_REPOSITORY,
  useValue: Hotel,
};

export const HotelAccountsRepository = {
  provide: HOTEL_ACCOUNTS_REPOSITORY,
  useValue: HotelAccount,
};

export const HotelBrandsRepository = {
  provide: HOTEL_BRANDS_REPOSITORY,
  useValue: HotelBrand,
};
