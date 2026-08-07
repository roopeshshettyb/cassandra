import { MenuItem } from './restaurant.model';

export const RESTAURANT_REPOSITORY = 'RESTAURANT_REPOSITORY';

export const RestaurantRepository = {
  provide: RESTAURANT_REPOSITORY,
  useValue: MenuItem,
};
