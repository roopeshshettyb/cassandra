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
