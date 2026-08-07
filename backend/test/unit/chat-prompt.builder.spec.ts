import { describeSpeakerRole, buildSystemInstructions, buildChatPrompt } from '../../src/chat/chat-prompt.builder';
import { ChatContextService } from '../../src/chat-context/chat-context.service';
import { AccountRole } from '../../src/common/constants/constants.service';

const CONTEXT = { context: 'guest asked about breakfast', lastMessageCount: 4 };

function stubContextService(context = CONTEXT): ChatContextService {
  return { buildChatContext: jest.fn().mockResolvedValue(context) } as unknown as ChatContextService;
}

describe('describeSpeakerRole', () => {
  it.each([
    [AccountRole.GUEST, 'a hotel guest staying at the property'],
    [AccountRole.HOTEL_OWNER, 'the hotel owner'],
    [AccountRole.HOTEL_STAFF, 'a member of the hotel staff'],
    [AccountRole.ADMIN, 'an admin user of the platform'],
  ])('describes %s', (role, expected) => {
    expect(describeSpeakerRole(role)).toBe(expected);
  });

  it.each([undefined, null, ''])('falls back to "a user" for %p', (role) => {
    expect(describeSpeakerRole(role)).toBe('a user');
  });

  it('falls back to "a user" for an unknown role', () => {
    expect(describeSpeakerRole('janitor')).toBe('a user');
  });
});

describe('buildSystemInstructions', () => {
  it('returns every part as a system message and echoes the context data', async () => {
    const ctx = stubContextService();
    const result = await buildSystemInstructions(ctx, 42, 'Cassandra');

    expect(ctx.buildChatContext).toHaveBeenCalledWith(42);
    expect(result.contextData).toBe(CONTEXT);
    expect(result.instructions.every((m) => m.role === 'system')).toBe(true);
    expect(result.instructionsWithoutRole).toBe(result.instructions.map((m) => m.content).join('\n'));
  });

  it('names the app and appends the conversation context', async () => {
    const result = await buildSystemInstructions(stubContextService(), 1, 'Cassandra');

    expect(result.instructions[0].content).toContain('You are Cassandra');
    expect(result.instructionsWithoutRole).toContain('guest asked about breakfast');
  });

  it('includes hotel-specific instructions when provided', async () => {
    const result = await buildSystemInstructions(stubContextService(), 1, 'App', '  No outside food.  ');

    expect(result.instructions[0].content).toContain('Hotel-specific instructions:\nNo outside food.');
  });

  it('omits the hotel-specific block for null and empty instructions', async () => {
    for (const llm of [null, undefined, '']) {
      const result = await buildSystemInstructions(stubContextService(), 1, 'App', llm);
      expect(result.instructions[0].content).not.toContain('Hotel-specific instructions');
    }
  });

  it('describes the authenticated speaker by role', async () => {
    const result = await buildSystemInstructions(stubContextService(), 1, 'App', null, AccountRole.HOTEL_STAFF);
    expect(result.instructionsWithoutRole).toContain('the authenticated speaker is a member of the hotel staff');
  });

  it('pins the response language when a known language code is set', async () => {
    const result = await buildSystemInstructions(stubContextService(), 1, 'App', null, AccountRole.GUEST, 'hi');

    expect(result.instructionsWithoutRole).toContain('the primary language is Hindi');
    expect(result.instructionsWithoutRole).not.toContain('a language for this chat is not set');
  });

  it('asks the model to detect and set the language when none is stored', async () => {
    const result = await buildSystemInstructions(stubContextService(), 1, 'App', null, AccountRole.GUEST, null);

    expect(result.instructionsWithoutRole).toContain('a language for this chat is not set');
    expect(result.instructionsWithoutRole).toContain('set_chat_language');
  });

  it('emits neither language instruction for an unsupported language code', async () => {
    const result = await buildSystemInstructions(stubContextService(), 1, 'App', null, AccountRole.GUEST, 'fr');

    expect(result.instructionsWithoutRole).not.toContain('the primary language is');
    expect(result.instructionsWithoutRole).not.toContain('a language for this chat is not set');
  });

  it('asks for short spoken replies on voice sessions', async () => {
    const voice = await buildSystemInstructions(stubContextService(), 1, 'App', null, AccountRole.GUEST, 'en', true);
    expect(voice.instructions[0].content).toContain('This interaction is happening over voice');
    expect(voice.instructions[0].content).not.toContain('Always respond in Markdown');
  });

  it('asks for Markdown on text sessions', async () => {
    const text = await buildSystemInstructions(stubContextService(), 1, 'App', null, AccountRole.GUEST, 'en', false);
    expect(text.instructions[0].content).toContain('Always respond in Markdown');
  });
});

describe('buildChatPrompt', () => {
  it('appends the user message after the system instructions', async () => {
    const { messages, contextData } = await buildChatPrompt(stubContextService(), 1, 'Is breakfast included?', 'App');

    const last = messages[messages.length - 1];
    expect(last).toEqual({ role: 'user', content: 'Is breakfast included?' });
    expect(messages.slice(0, -1).every((m) => m.role === 'system')).toBe(true);
    expect(contextData).toBe(CONTEXT);
  });

  it('carries role, language and voice settings into the system messages', async () => {
    const { messages } = await buildChatPrompt(
      stubContextService(),
      1,
      'hi',
      'App',
      AccountRole.HOTEL_OWNER,
      'No pets.',
      'ta',
      true,
    );

    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
    expect(system).toContain('the hotel owner');
    expect(system).toContain('No pets.');
    expect(system).toContain('Tamil');
    expect(system).toContain('This interaction is happening over voice');
  });
});
