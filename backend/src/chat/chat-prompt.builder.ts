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
): Promise<{ contextData: { context: string; lastMessageCount: number }; instructions: string }> {
  const contextData = await chatContextService.buildChatContext(chatId);

  let systemContent = `You are ${appName}, a hotel companion that helps with anything related to the guest's stay.

The person speaking to you over chat or voice may be:
- a room guest staying at the hotel,
- the hotel owner,
- or a member of the hotel staff.

Do not assume they are always the guest. Infer who is speaking from the conversation and respond appropriately for their role (for example, give operational guidance to staff, and guest-facing guidance to guests).

Use your tools when helpful and help the user to your best ability.

Always respond in Markdown.`;

  if (llmInstructions && llmInstructions.trim().length > 0) {
    systemContent += `\n\nHotel-specific instructions:\n${llmInstructions.trim()}`;
  }

  const parts: string[] = [systemContent, `This is the context of the coversation so far : ${contextData.context}`];

  const roleDescription = describeSpeakerRole(speakerRole);
  parts.push(`For this ${languageCode ? 'voice' : 'chat'} session, the authenticated speaker is ${roleDescription}. Address them appropriately for that role.`);

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

  const instructions = parts.join('\n\n');

  return {
    contextData,
    instructions,
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

  // In the future this can include attachment-derived content as well.
  const textContents: string[] = [];

  const messages: ChatMessageInput[] = [{ role: 'system', content: instructions }];

  if (textContents.length > 0) {
    messages.push({
      role: 'system',
      content: `This is the content from the attachments the user has shared: ${textContents.join('\n\n')}`,
    });
  }

  messages.push({
    role: 'user',
    content: userMessage,
  });

  return {
    contextData,
    messages,
  };
}
