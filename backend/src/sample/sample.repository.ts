import { Sample } from './sample.model';

export const SAMPLE_REPOSITORY = 'SAMPLE_REPOSITORY';

export const SampleRepository = {
  provide: SAMPLE_REPOSITORY,
  useValue: Sample,
};
