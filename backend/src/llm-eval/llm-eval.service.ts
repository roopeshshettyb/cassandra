import { Inject, Injectable } from '@nestjs/common';
import { AIMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { LLM_EVAL_REPOSITORY } from './llm-eval.repository';
import { LlmEval, EvalDimension } from './llm-eval.model';
import { ConstantsService } from '../common/constants/constants.service';
import { LangGraphService } from '../langgraph/langgraph.service';
import { CostsService } from '../costs/costs.service';
import { CostType } from '../costs/costs.model';
import { ToolCallRecord } from '../messages/message.model';
import { buildEvalMessages } from './llm-eval-prompt.builder';
import { LoggerService } from '../common/logger.service';

const EVAL_SCHEMA = z.object({
  toolCall: z.object({ passed: z.boolean(), reasoning: z.string() }).nullable(),
  responseQuality: z.object({ passed: z.boolean(), reasoning: z.string() }),
});

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
      const messages = buildEvalMessages(params.userMessage, params.assistantMessage, params.toolCalls);
      const judgeModel = this.constantsService.private.LLM.TEXT_MODEL;
      const { raw, parsed } = await this.langGraphService
        .createModel(0)
        .withStructuredOutput(EVAL_SCHEMA, { name: 'ChatTurnEval', includeRaw: true })
        .invoke(messages);

      const usage = (raw as AIMessage).usage_metadata as { input_tokens?: number; output_tokens?: number; total_tokens?: number } | undefined;
      this.costsService.recordLlmCost({
        type: CostType.LLM_EVAL,
        usage: {
          promptTokens: usage?.input_tokens ?? 0,
          completionTokens: usage?.output_tokens ?? 0,
          totalTokens: usage?.total_tokens ?? 0,
        },
        bookingId: params.bookingId,
        hotelId: params.hotelId,
        accountId: params.accountId,
        role: params.role,
        chatId: params.chatId,
        messageId: params.messageId,
      });

      const rows: Partial<LlmEval>[] = [];
      if (params.toolCalls.length && parsed.toolCall) {
        rows.push({
          chatId: params.chatId,
          messageId: params.messageId,
          dimension: EvalDimension.TOOL_CALL,
          passed: parsed.toolCall.passed,
          reasoning: parsed.toolCall.reasoning,
          judgeModel,
        });
      }
      rows.push({
        chatId: params.chatId,
        messageId: params.messageId,
        dimension: EvalDimension.RESPONSE_QUALITY,
        passed: parsed.responseQuality.passed,
        reasoning: parsed.responseQuality.reasoning,
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
}