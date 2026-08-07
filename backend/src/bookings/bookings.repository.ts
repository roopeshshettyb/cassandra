import { Booking } from './bookings.model';

export const BOOKINGS_REPOSITORY = 'BOOKINGS_REPOSITORY';

export const BookingsRepository = {
  provide: BOOKINGS_REPOSITORY,
  useValue: Booking,
};
