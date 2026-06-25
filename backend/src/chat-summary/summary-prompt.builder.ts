import { Message } from '../messages/message.model';
import { MessageFormatter } from '../messages/message-formatter';

const fillTargetWords = (template: string, targetWords: number): string =>
  template.replace('{TARGET_WORDS}', String(targetWords));

export const buildTier1Prompt = (instructions: string, messages: Message[], targetWords: number): string =>
  `${fillTargetWords(instructions, targetWords)}\n\n---\n\n${MessageFormatter.formatMessages(messages)}`;

export const buildTier2Prompt = (
  instructions: string,
  existingTier2: string | null,
  tier1Summaries: string[],
  targetWords: number,
): string => {
  const tier1Block = tier1Summaries.map((s, i) => `Chunk ${i + 1}:\n${s}`).join('\n\n');
  const existing = existingTier2 ? `\nExisting long-term summary:\n${existingTier2}\n\n---\n` : '';
  return `${fillTargetWords(instructions, targetWords)}${existing}\n\nNew chunk summaries:\n${tier1Block}`;
};
