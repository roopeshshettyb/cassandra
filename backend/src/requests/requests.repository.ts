import { Request } from './requests.model';

export const REQUESTS_REPOSITORY = 'REQUESTS_REPOSITORY';

export const RequestsRepository = {
  provide: REQUESTS_REPOSITORY,
  useValue: Request,
};
