import { Inject, Injectable } from '@nestjs/common';
import { LLM_EVAL_REPOSITORY } from './llm-eval.repository';
import { LlmEval, EvalDimension } from './llm-eval.model';
import { ConstantsService } from '../common/constants/constants.service';
import { LangGraphService } from '../langgraph/langgraph.service';
import { CostsService } from '../costs/costs.service';
import { CostType } from '../costs/costs.model';
import { ToolCallRecord } from '../messages/message.model';
import { judgeTurn, judgeSummary } from './llm-eval.judge';
import { LoggerService } from '../common/logger.service';

export interface MaybeEvaluateParams {
  chatId: number;
  messageId: number;
  userMessage: string;
  assistantMessage: string;
  toolCalls: ToolCallRecord[];
  accountId: number;
  role: string;
  hotelId: number | null;
  bookingId: number | null;
}

export interface MaybeEvaluateSummaryParams {
  chatId: number;
  messageId: number;
  previousSummary: string | null;
  foldedMessages: string;
  newSummary: string;
  hotelId: number | null;
}

@Injectable()
export class LlmEvalService {
  constructor(
    @Inject(LLM_EVAL_REPOSITORY) private readonly evalRepository: typeof LlmEval,
    private readonly constantsService: ConstantsService,
    private readonly langGraphService: LangGraphService,
    private readonly costsService: CostsService,
    private readonly logger: LoggerService,
  ) {}

  async maybeEvaluate(params: MaybeEvaluateParams): Promise<void> {
    const cfg = this.constantsService.private.LLM.EVAL;
    if (!cfg.ENABLED || Math.random() >= cfg.SAMPLE_RATE) return;

    try {
      const judgeModel = this.constantsService.private.LLM.TEXT_MODEL;
      const { verdict, usage } = await judgeTurn(
        this.langGraphService,
        params.userMessage,
        params.assistantMessage,
        params.toolCalls,
      );

      this.costsService.recordLlmCost({
        type: CostType.LLM_EVAL,
        usage,
        bookingId: params.bookingId,
        hotelId: params.hotelId,
        accountId: params.accountId,
        role: params.role,
        chatId: params.chatId,
        messageId: params.messageId,
      });

      const rows: Partial<LlmEval>[] = [];
      if (params.toolCalls.length && verdict.toolCall) {
        rows.push({
          chatId: params.chatId,
          messageId: params.messageId,
          dimension: EvalDimension.TOOL_CALL,
          passed: verdict.toolCall.passed,
          reasoning: verdict.toolCall.reasoning,
          judgeModel,
        });
      }
      rows.push({
        chatId: params.chatId,
        messageId: params.messageId,
        dimension: EvalDimension.RESPONSE_QUALITY,
        passed: verdict.responseQuality.passed,
        reasoning: verdict.responseQuality.reasoning,
        judgeModel,
      });

      await this.evalRepository.bulkCreate(rows as LlmEval[]);
    } catch (err) {
      this.logger.error({
        error: err,
        serviceName: 'LlmEval',
        actionName: `maybeEvaluate chatId=${params.chatId} messageId=${params.messageId}`,
      });
    }
  }

  // Evaluates a freshly-written rolling summary. Summaries are infrequent (only
  // when the token threshold trips), so every one is judged when eval is enabled
  // rather than sampled.
  async maybeEvaluateSummary(params: MaybeEvaluateSummaryParams): Promise<void> {
    const cfg = this.constantsService.private.LLM.EVAL;
    if (!cfg.ENABLED) return;

    try {
      const judgeModel = this.constantsService.private.LLM.TEXT_MODEL;
      const { verdict, usage } = await judgeSummary(
        this.langGraphService,
        params.previousSummary,
        params.foldedMessages,
        params.newSummary,
      );

      this.costsService.recordLlmCost({
        type: CostType.LLM_EVAL,
        usage,
        bookingId: null,
        hotelId: params.hotelId,
        accountId: null,
        role: null,
        chatId: params.chatId,
        messageId: params.messageId,
      });

      await this.evalRepository.create({
        chatId: params.chatId,
        messageId: params.messageId,
        dimension: EvalDimension.SUMMARY_ACCURACY,
        passed: verdict.summaryAccuracy.passed,
        reasoning: verdict.summaryAccuracy.reasoning,
        judgeModel,
      } as LlmEval);
    } catch (err) {
      this.logger.error({
        error: err,
        serviceName: 'LlmEval',
        actionName: `maybeEvaluateSummary chatId=${params.chatId} messageId=${params.messageId}`,
      });
    }
  }
}