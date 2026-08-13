import { AgentJob } from './agent-jobs.model';

export const AGENT_JOBS_REPOSITORY = 'AGENT_JOBS_REPOSITORY';

export const AgentJobsRepository = {
  provide: AGENT_JOBS_REPOSITORY,
  useValue: AgentJob,
};
