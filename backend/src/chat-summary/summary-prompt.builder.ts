import { Message } from '../messages/message.model';
import { MessageFormatter } from '../messages/message-formatter';

export const buildSummaryPrompt = (
  instructions: string,
  existingSummary: string | null,
  messages: Message[],
  targetWords: number,
): string => {
  const filled = instructions.replace('{TARGET_WORDS}', String(targetWords));
  const prior = existingSummary ? `Existing summary:\n${existingSummary}\n\n---\n\n` : '';
  return `${filled}\n\n${prior}New messages to incorporate:\n${MessageFormatter.formatMessages(messages)}`;
};
