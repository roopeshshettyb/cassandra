import { Cost } from './costs.model';

export const COSTS_REPOSITORY = 'COSTS_REPOSITORY';

export const CostsRepository = {
  provide: COSTS_REPOSITORY,
  useValue: Cost,
};

