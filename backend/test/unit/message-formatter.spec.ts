import { MessageFormatter } from '../../src/messages/message-formatter';
import { Message, MessageRole, ToolCallRecord } from '../../src/messages/message.model';

// The formatter only reads role/content/toolCalls, so a plain object is enough.
function msg(role: MessageRole, content: string, toolCalls?: ToolCallRecord[]): Message {
  return { role, content, toolCalls } as Message;
}

function toolCall(overrides: Partial<ToolCallRecord> = {}): ToolCallRecord {
  return { toolName: 'get_menu', toolCallId: 'tc_1', input: { hotelId: 7 }, ...overrides };
}

describe('MessageFormatter.formatToolCalls', () => {
  it('returns an empty string for null, undefined and empty lists', () => {
    expect(MessageFormatter.formatToolCalls(null)).toBe('');
    expect(MessageFormatter.formatToolCalls(undefined)).toBe('');
    expect(MessageFormatter.formatToolCalls([])).toBe('');
  });

  it('formats a call with only an input', () => {
    expect(MessageFormatter.formatToolCalls([toolCall()])).toBe('[Tool: get_menu] Input: {"hotelId":7}');
  });

  it('appends the output when present', () => {
    expect(MessageFormatter.formatToolCalls([toolCall({ output: { items: 2 } })])).toBe(
      '[Tool: get_menu] Input: {"hotelId":7} Output: {"items":2}',
    );
  });

  it('includes a null output, which is a real result rather than a missing one', () => {
    expect(MessageFormatter.formatToolCalls([toolCall({ output: null })])).toContain('Output: null');
  });

  it('appends the error when present', () => {
    expect(MessageFormatter.formatToolCalls([toolCall({ error: 'timeout' })])).toBe(
      '[Tool: get_menu] Input: {"hotelId":7} Error: timeout',
    );
  });

  it('emits output before error when both are present', () => {
    const line = MessageFormatter.formatToolCalls([toolCall({ output: 'partial', error: 'timeout' })]);
    expect(line).toBe('[Tool: get_menu] Input: {"hotelId":7} Output: "partial" Error: timeout');
  });

  it('puts each call on its own line', () => {
    const lines = MessageFormatter.formatToolCalls([
      toolCall({ toolName: 'a', input: {} }),
      toolCall({ toolName: 'b', input: {} }),
    ]);
    expect(lines.split('\n')).toEqual(['[Tool: a] Input: {}', '[Tool: b] Input: {}']);
  });
});

describe('MessageFormatter.formatMessage', () => {
  it('labels user messages', () => {
    expect(MessageFormatter.formatMessage(msg(MessageRole.USER, 'hi'))).toBe('User: hi');
  });

  it('labels every non-user role as Assistant', () => {
    expect(MessageFormatter.formatMessage(msg(MessageRole.ASSISTANT, 'hello'))).toBe('Assistant: hello');
    expect(MessageFormatter.formatMessage(msg(MessageRole.SYSTEM, 'boot'))).toBe('Assistant: boot');
  });

  it('puts the tool block on the line after the content', () => {
    const formatted = MessageFormatter.formatMessage(msg(MessageRole.ASSISTANT, 'checking', [toolCall()]));
    expect(formatted).toBe('Assistant: checking\n[Tool: get_menu] Input: {"hotelId":7}');
  });

  it('adds no trailing newline when there are no tool calls', () => {
    expect(MessageFormatter.formatMessage(msg(MessageRole.ASSISTANT, 'done', []))).toBe('Assistant: done');
  });
});

describe('MessageFormatter.formatMessages', () => {
  it('separates messages with a blank line', () => {
    const formatted = MessageFormatter.formatMessages([
      msg(MessageRole.USER, 'hi'),
      msg(MessageRole.ASSISTANT, 'hello'),
    ]);
    expect(formatted).toBe('User: hi\n\nAssistant: hello');
  });

  it('returns an empty string for no messages', () => {
    expect(MessageFormatter.formatMessages([])).toBe('');
  });
});
