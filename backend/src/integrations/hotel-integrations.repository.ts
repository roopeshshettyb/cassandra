import { HotelIntegration } from './hotel-integrations.model';

export const HOTEL_INTEGRATIONS_REPOSITORY = 'HOTEL_INTEGRATIONS_REPOSITORY';

export const HotelIntegrationsRepository = {
  provide: HOTEL_INTEGRATIONS_REPOSITORY,
  useValue: HotelIntegration,
};
