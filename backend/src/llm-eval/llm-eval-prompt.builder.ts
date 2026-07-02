import { SystemMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { ToolCallRecord } from '../messages/message.model';

export function buildEvalMessages(userMessage: string, assistantMessage: string, toolCalls: ToolCallRecord[]): BaseMessage[] {
  const toolCallsSection = toolCalls.length
    ? `Tool calls made by the assistant:\n${JSON.stringify(toolCalls.map((t) => ({ tool: t.toolName, input: t.input, output: t.output, error: t.error })))}`
    : 'No tools were called.';

  const prompt = `You are a meticulous QA judge for a hotel-concierge AI assistant. Evaluate the assistant's most recent turn below.

Guest message: "${userMessage}"

${toolCallsSection}

Assistant response: "${assistantMessage}"

Judge two dimensions:
1. toolCall — Only relevant if tools were called: were the tool choices and inputs appropriate and necessary for the guest's request? If no tools were called, return null.
2. responseQuality — Is the assistant's response accurate, helpful, on-topic, and appropriately concise for a hotel guest?

For each judged dimension return passed (boolean) and a one-sentence reasoning.`;

  return [new SystemMessage('You are an impartial QA judge. Respond only via the provided structured schema.'), new HumanMessage(prompt)];
}

// Generic judge prompt for any single-shot LLM task (extraction, OCR, generation).
// `input` is whatever grounding we have (source text, transcript, or a note that the
// source is an image); `imageUrls` lets the judge verify against the source visually.
export function buildTaskEvalMessages(taskDescription: string, input: string, output: string, imageUrls: string[] = []): BaseMessage[] {
  const prompt = `You are a meticulous QA judge for an AI system used by hotels. An LLM performed the following task — judge whether its output is accurate and faithful to the input.

Task: ${taskDescription}

Input provided to the LLM:
"${input}"

Output produced by the LLM:
"${output}"

Judge accuracy — is the output faithful to the input (no invented or contradicted facts), complete for the task, and correctly formatted? If source images are attached, verify the output against them.

Return passed (boolean) and a one-sentence reasoning.`;

  const content: ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[] = [{ type: 'text', text: prompt }];
  for (const url of imageUrls) {
    content.push({ type: 'image_url', image_url: { url } });
  }

  return [new SystemMessage('You are an impartial QA judge. Respond only via the provided structured schema.'), new HumanMessage({ content })];
}

export function buildSummaryEvalMessages(previousSummary: string | null, foldedMessages: string, newSummary: string): BaseMessage[] {
  const previousSection = previousSummary
    ? `Previous summary (must be preserved):\n"${previousSummary}"`
    : 'There was no previous summary.';

  const prompt = `You are a meticulous QA judge for a hotel-concierge AI. A rolling conversation summary was just updated. Judge whether the new summary is accurate.

${previousSection}

New messages that were folded into the summary:
"${foldedMessages}"

New summary:
"${newSummary}"

Judge summaryAccuracy — does the new summary faithfully capture the key facts from the folded messages (guest preferences, requests and their status, bookings, important details) AND retain the standing information from the previous summary, without inventing or contradicting facts?

Return passed (boolean) and a one-sentence reasoning.`;

  return [new SystemMessage('You are an impartial QA judge. Respond only via the provided structured schema.'), new HumanMessage(prompt)];
}
