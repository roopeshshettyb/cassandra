import { Message } from '../messages/message.model';

const formatMessages = (messages: Message[]): string => {
  const parts: string[] = [];
  for (const m of messages) {
    const role = m.role === 'user' ? 'User' : 'Assistant';
    parts.push(`${role}: ${m.content}`);
    if (m.toolCalls?.length) {
      for (const tc of m.toolCalls) {
        parts.push(`[Tool: ${tc.toolName}] Input: ${JSON.stringify(tc.input)}` +
          (tc.output !== undefined ? ` Output: ${JSON.stringify(tc.output)}` : '') +
          (tc.error ? ` Error: ${tc.error}` : ''));
      }
    }
  }
  return parts.join('\n\n');
};

export const buildTier1Prompt = (messages: Message[], targetWords: number): string => {
  return `You are summarizing a chunk of a hotel concierge AI chat. Produce a concise summary in approximately ${targetWords} words.

Preserve:
- Guest preferences (room, food, language, accessibility)
- Requests made (service requests, what was requested, status, urgency)
- Decisions and confirmations (bookings, reservations, special arrangements)
- Key facts (names, dates, room numbers, hotel info, costs mentioned)
- Tool calls and their outcomes

Skip:
- Pleasantries, small talk
- Acknowledgements without information

Output plain prose. No markdown, no headers, no bullet points. Refer to the guest as "the guest" and the AI as "the assistant".

---

${formatMessages(messages)}`;
};

export const buildTier2Prompt = (existingTier2: string | null, tier1Summaries: string[], targetWords: number): string => {
  const tier1Block = tier1Summaries.map((s, i) => `Chunk ${i + 1}:\n${s}`).join('\n\n');
  const existing = existingTier2 ? `\nExisting long-term summary:\n${existingTier2}\n\n---\n` : '';
  return `You are maintaining the long-term memory of a hotel concierge AI chat. Combine the existing long-term summary (if any) with the new chunk summaries into one consolidated summary in approximately ${targetWords} words.

Preserve:
- Standing guest preferences
- Outstanding requests and their status
- Confirmed decisions and arrangements
- Key facts (names, dates, room numbers, hotel info)

Merge duplicates and resolve contradictions in favor of the most recent information. Output plain prose only.
${existing}
New chunk summaries:
${tier1Block}`;
};
