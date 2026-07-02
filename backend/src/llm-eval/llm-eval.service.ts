import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { LLM_EVAL_REPOSITORY } from './llm-eval.repository';
import { LlmEval, EvalDimension } from './llm-eval.model';
import { ConstantsService } from '../common/constants/constants.service';
import { LangGraphService } from '../langgraph/langgraph.service';
import { CostsService } from '../costs/costs.service';
import { CostType } from '../costs/costs.model';
import { ToolCallRecord } from '../messages/message.model';
import { judgeTurn, judgeSummary, judgeTask, Usage } from './llm-eval.judge';
import { LoggerService } from '../common/logger.service';

// Where an eval belongs (cost attribution + row FKs). All optional: chat-turn
// evals carry chat/message ids, extraction-flow evals may carry none.
export interface EvalRefs {
  chatId?: number | null;
  messageId?: number | null;
  accountId?: number | null;
  role?: string | null;
  hotelId?: number | null;
  bookingId?: number | null;
}

interface DimensionVerdict {
  dimension: EvalDimension;
  passed: boolean;
  reasoning: string;
}

export interface MaybeEvaluateParams extends EvalRefs {
  chatId: number;
  messageId: number;
  userMessage: string;
  assistantMessage: string;
  toolCalls: ToolCallRecord[];
}

export interface MaybeEvaluateSummaryParams extends EvalRefs {
  chatId: number;
  messageId: number;
  previousSummary: string | null;
  foldedMessages: string;
  newSummary: string;
}

export interface MaybeEvaluateTaskParams extends EvalRefs {
  dimension: EvalDimension;
  taskDescription: string;
  input: string;
  output: string;
  imageUrls?: string[];
}

@Injectable()
export class LlmEvalService {
  constructor(
    @Inject(LLM_EVAL_REPOSITORY) private readonly evalRepository: typeof LlmEval,
    private readonly constantsService: ConstantsService,
    @Inject(forwardRef(() => LangGraphService)) private readonly langGraphService: LangGraphService,
    private readonly costsService: CostsService,
    private readonly logger: LoggerService,
  ) {}

  private get cfg() {
    return this.constantsService.private.LLM.EVAL;
  }

  // Single persistence path for every eval flow: one cost record per judge call,
  // one row per judged dimension. Only verdicts are stored — never raw content.
  private async persistVerdicts(verdicts: DimensionVerdict[], usage: Usage, refs: EvalRefs): Promise<void> {
    this.costsService.recordLlmCost({
      type: CostType.LLM_EVAL,
      usage,
      bookingId: refs.bookingId ?? null,
      hotelId: refs.hotelId ?? null,
      accountId: refs.accountId ?? null,
      role: refs.role ?? null,
      chatId: refs.chatId ?? null,
      messageId: refs.messageId ?? null,
    });

    const judgeModel = this.constantsService.private.LLM.TEXT_MODEL;
    const rows = verdicts.map((v) => ({
      chatId: refs.chatId ?? null,
      messageId: refs.messageId ?? null,
      dimension: v.dimension,
      passed: v.passed,
      reasoning: v.reasoning,
      judgeModel,
    }));
    await this.evalRepository.bulkCreate(rows as LlmEval[]);
  }

  // Shared guard: evals are observability, never a failure path for the caller.
  private async runSafely(actionName: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.logger.error({ error: err, serviceName: 'LlmEval', actionName });
    }
  }

  // Chat/voice turns are high-volume → sampled via SAMPLE_RATE.
  async maybeEvaluate(params: MaybeEvaluateParams): Promise<void> {
    if (!this.cfg.ENABLED || Math.random() >= this.cfg.SAMPLE_RATE) return;

    await this.runSafely(`maybeEvaluate chatId=${params.chatId} messageId=${params.messageId}`, async () => {
      const { verdict, usage } = await judgeTurn(this.langGraphService, params.userMessage, params.assistantMessage, params.toolCalls);

      const verdicts: DimensionVerdict[] = [];
      if (params.toolCalls.length && verdict.toolCall) {
        verdicts.push({ dimension: EvalDimension.TOOL_CALL, ...verdict.toolCall });
      }
      verdicts.push({ dimension: EvalDimension.RESPONSE_QUALITY, ...verdict.responseQuality });

      await this.persistVerdicts(verdicts, usage, params);
    });
  }

  // Summaries are infrequent (token-threshold gated) → every one is judged.
  async maybeEvaluateSummary(params: MaybeEvaluateSummaryParams): Promise<void> {
    if (!this.cfg.ENABLED) return;

    await this.runSafely(`maybeEvaluateSummary chatId=${params.chatId} messageId=${params.messageId}`, async () => {
      const { verdict, usage } = await judgeSummary(this.langGraphService, params.previousSummary, params.foldedMessages, params.newSummary);
      await this.persistVerdicts([{ dimension: EvalDimension.SUMMARY_ACCURACY, ...verdict.summaryAccuracy }], usage, params);
    });
  }

  // Generic hook for single-shot LLM tasks (extraction, OCR, title generation).
  // These are infrequent admin/setup flows → every one is judged. Input is
  // truncated so oversized sources (crawl dumps) can't blow up judge cost.
  async maybeEvaluateTask(params: MaybeEvaluateTaskParams): Promise<void> {
    if (!this.cfg.ENABLED) return;

    await this.runSafely(`maybeEvaluateTask dimension=${params.dimension}`, async () => {
      const max = this.cfg.TASK_INPUT_MAX_CHARS;
      const { verdict, usage } = await judgeTask(
        this.langGraphService,
        params.taskDescription,
        params.input.length > max ? `${params.input.slice(0, max)}… [truncated]` : params.input,
        params.output.length > max ? `${params.output.slice(0, max)}… [truncated]` : params.output,
        params.imageUrls ?? [],
      );
      await this.persistVerdicts([{ dimension: params.dimension, ...verdict.accuracy }], usage, params);
    });
  }
}
