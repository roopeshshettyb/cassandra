import { z } from 'zod';
import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { LangGraphService } from '../langgraph/langgraph.service';
import { ToolCallRecord } from '../messages/message.model';
import { buildEvalMessages, buildSummaryEvalMessages } from './llm-eval-prompt.builder';

const VERDICT = z.object({ passed: z.boolean(), reasoning: z.string() });

// Single source of truth for the LLM-as-judge verdict shapes.
export const EVAL_SCHEMA = z.object({
  toolCall: VERDICT.nullable(),
  responseQuality: VERDICT,
});

export const SUMMARY_EVAL_SCHEMA = z.object({ summaryAccuracy: VERDICT });

export type EvalVerdict = z.infer<typeof EVAL_SCHEMA>;
export type Usage = { promptTokens: number; completionTokens: number; totalTokens: number };

export interface JudgeResult {
  verdict: EvalVerdict;
  usage: Usage;
}

export interface SummaryJudgeResult {
  verdict: z.infer<typeof SUMMARY_EVAL_SCHEMA>;
  usage: Usage;
}

// Shared invoke: runs the judge model with structured output and extracts usage.
async function runJudge<T>(langGraphService: LangGraphService, schema: z.ZodType<T>, name: string, messages: BaseMessage[]): Promise<{ verdict: T; usage: Usage }> {
  const { raw, parsed } = await langGraphService
    .createModel(0)
    .withStructuredOutput(schema, { name, includeRaw: true })
    .invoke(messages);

  const u = (raw as AIMessage).usage_metadata as { input_tokens?: number; output_tokens?: number; total_tokens?: number } | undefined;
  return {
    verdict: parsed as T,
    usage: { promptTokens: u?.input_tokens ?? 0, completionTokens: u?.output_tokens ?? 0, totalTokens: u?.total_tokens ?? 0 },
  };
}

// Pure LLM-as-judge: grades one assistant turn. No sampling, no DB, no cost
// recording — the caller (live eval service or the regression suite) decides what
// to do with the verdict. This is the shared judging business logic.
export function judgeTurn(
  langGraphService: LangGraphService,
  userMessage: string,
  assistantMessage: string,
  toolCalls: ToolCallRecord[],
): Promise<JudgeResult> {
  return runJudge(langGraphService, EVAL_SCHEMA, 'ChatTurnEval', buildEvalMessages(userMessage, assistantMessage, toolCalls));
}

// Pure LLM-as-judge for a rolling summary update: does the new summary faithfully
// capture the folded messages and retain the previous summary?
export function judgeSummary(
  langGraphService: LangGraphService,
  previousSummary: string | null,
  foldedMessages: string,
  newSummary: string,
): Promise<SummaryJudgeResult> {
  return runJudge(langGraphService, SUMMARY_EVAL_SCHEMA, 'SummaryEval', buildSummaryEvalMessages(previousSummary, foldedMessages, newSummary));
}
