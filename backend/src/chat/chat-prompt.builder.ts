import { ChatContextService } from '../chat-context/chat-context.service';
import { ChatMessageInput } from '../langgraph/langgraph.service';

export interface ChatPromptResult {
  contextData: { context: string; lastMessageCount: number };
  messages: ChatMessageInput[];
}

export function describeSpeakerRole(role: string | undefined | null): string {
  if (!role) {
    return 'a user';
  }
  if (role === 'guest') {
    return 'a hotel guest staying at the property';
  }
  if (role === 'hotel_owner') {
    return 'the hotel owner';
  }
  if (role === 'hotel_staff') {
    return 'a member of the hotel staff';
  }
  if (role === 'admin') {
    return 'an admin user of the platform';
  }
  return 'a user';
}

/**
 * Build the shared system instructions and conversational context
 * string for a given chat. This is suitable for passing to
 * `session.instructions` in the Realtime API.
 */
export async function buildSystemInstructions(
  chatContextService: ChatContextService,
  chatId: number,
  appName: string,
  llmInstructions?: string | null,
  speakerRole?: string,
  languageCode?: string | null,
): Promise<{ contextData: { context: string; lastMessageCount: number }; instructions: string; instructionsWithoutRole: string }> {
  const contextData = await chatContextService.buildChatContext(chatId);

  let systemContent = `You are ${appName}, a hotel companion that helps with anything related to the hotel operations.

  ${llmInstructions?.length > 0 ? `Hotel-specific instructions:\n${llmInstructions.trim()}` : ''}

Use your tools when helpful and help the user to your best ability.

Always respond in Markdown.`;

  const parts: string[] = [systemContent];

  const roleDescription = describeSpeakerRole(speakerRole);
  parts.push(`For this session, the authenticated speaker is ${roleDescription}. Address them appropriately for that role.`);

  const languageDisplayMap: Record<string, string> = {
    en: 'English',
    hi: 'Hindi',
    kn: 'Kannada',
    ta: 'Tamil',
    te: 'Telugu',
  };

  if (languageCode && languageDisplayMap[languageCode]) {
    parts.push(
      `For this session, the primary language is ${languageDisplayMap[languageCode]}. You must respond only in ${languageDisplayMap[languageCode]}. If the user speaks in another language, switch immediately to that language and update the stored language using the set_chat_language tool.`,
    );
  } else if (!languageCode) {
    parts.push(
      'Currently a language for this chat is not set. Only use and respond in one of these languages: English, Hindi, Kannada, Tamil, Telugu. If the user speaks in any other language, politely ask them to use one of these five. After the users first message once you have deduced the language use the set_chat_language tool and update it.',
    );
  }

  parts.push(`This is the context of the coversation so far : ${contextData.context}`);

  const instructions: any = parts.map((ele) => {
    return { role: 'system', ele };
  });

  return {
    contextData,
    instructions,
    instructionsWithoutRole: parts.join('\n'),
  };
}

/**
 * Build the shared system instructions and conversational context
 * for a given chat, plus the current user message.
 *
 * This helper is reused for both text (`/chat`) and voice (`/voice`) flows
 * that rely on LangGraph.
 */
export async function buildChatPrompt(
  chatContextService: ChatContextService,
  chatId: number,
  userMessage: string,
  appName: string,
  speakerRole?: string,
  llmInstructions?: string | null,
  languageCode?: string | null,
): Promise<ChatPromptResult> {
  const { contextData, instructions } = await buildSystemInstructions(chatContextService, chatId, appName, llmInstructions, speakerRole, languageCode);

  const messages: any = instructions;

  messages.push({
    role: 'user',
    content: userMessage,
  });

  return {
    contextData,
    messages,
  };
}
