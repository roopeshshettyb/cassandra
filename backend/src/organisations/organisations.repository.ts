import { Organisation } from './organisations.model';

export const ORGANISATIONS_REPOSITORY = 'ORGANISATIONS_REPOSITORY';

export const OrganisationsRepository = {
  provide: ORGANISATIONS_REPOSITORY,
  useValue: Organisation,
};
