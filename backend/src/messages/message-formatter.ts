import { Message, ToolCallRecord } from './message.model';

// Single source of truth for serialising messages (with tool calls) into the
// plain-text form sent to LLMs / used in summaries.
export class MessageFormatter {
  static formatToolCalls(toolCalls: ToolCallRecord[] | null | undefined): string {
    if (!toolCalls?.length) return '';
    const lines: string[] = [];
    for (const tc of toolCalls) {
      let line = `[Tool: ${tc.toolName}] Input: ${JSON.stringify(tc.input)}`;
      if (tc.output !== undefined) line += ` Output: ${JSON.stringify(tc.output)}`;
      if (tc.error) line += ` Error: ${tc.error}`;
      lines.push(line);
    }
    return lines.join('\n');
  }

  static formatMessage(message: Message): string {
    const role = message.role === 'user' ? 'User' : 'Assistant';
    const toolBlock = this.formatToolCalls(message.toolCalls);
    return toolBlock ? `${role}: ${message.content}\n${toolBlock}` : `${role}: ${message.content}`;
  }

  static formatMessages(messages: Message[]): string {
    return messages.map((m) => this.formatMessage(m)).join('\n\n');
  }
}
