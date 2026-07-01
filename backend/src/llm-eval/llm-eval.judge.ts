import { z } from 'zod';
import { AIMessage } from '@langchain/core/messages';
import { LangGraphService } from '../langgraph/langgraph.service';
import { ToolCallRecord } from '../messages/message.model';
import { buildEvalMessages } from './llm-eval-prompt.builder';

// Single source of truth for the LLM-as-judge verdict shape.
export const EVAL_SCHEMA = z.object({
  toolCall: z.object({ passed: z.boolean(), reasoning: z.string() }).nullable(),
  responseQuality: z.object({ passed: z.boolean(), reasoning: z.string() }),
});

export type EvalVerdict = z.infer<typeof EVAL_SCHEMA>;

export interface JudgeResult {
  verdict: EvalVerdict;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

// Pure LLM-as-judge: grades one assistant turn. No sampling, no DB, no cost
// recording — the caller (live eval service or the regression suite) decides what
// to do with the verdict. This is the shared judging business logic.
export async function judgeTurn(
  langGraphService: LangGraphService,
  userMessage: string,
  assistantMessage: string,
  toolCalls: ToolCallRecord[],
): Promise<JudgeResult> {
  const messages = buildEvalMessages(userMessage, assistantMessage, toolCalls);
  const { raw, parsed } = await langGraphService
    .createModel(0)
    .withStructuredOutput(EVAL_SCHEMA, { name: 'ChatTurnEval', includeRaw: true })
    .invoke(messages);

  const usage = (raw as AIMessage).usage_metadata as { input_tokens?: number; output_tokens?: number; total_tokens?: number } | undefined;
  return {
    verdict: parsed,
    usage: {
      promptTokens: usage?.input_tokens ?? 0,
      completionTokens: usage?.output_tokens ?? 0,
      totalTokens: usage?.total_tokens ?? 0,
    },
  };
}
