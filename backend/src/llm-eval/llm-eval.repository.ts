import { LlmEval } from './llm-eval.model';

export const LLM_EVAL_REPOSITORY = 'LLM_EVAL_REPOSITORY';

export const LlmEvalRepository = {
  provide: LLM_EVAL_REPOSITORY,
  useValue: LlmEval,
};
