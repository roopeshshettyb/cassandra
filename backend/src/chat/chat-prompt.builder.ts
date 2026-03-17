import { ChatContextService } from '../chat-context/chat-context.service';
import { ChatMessageInput } from '../langgraph/langgraph.service';
import { AccountRole } from '../common/constants/constants.service';

export interface ChatPromptResult {
  contextData: { context: string; lastMessageCount: number };
  messages: ChatMessageInput[];
}

export function describeSpeakerRole(role: string | undefined | null): string {
  if (!role) return 'a user';
  const map: Partial<Record<AccountRole, string>> = {
    [AccountRole.GUEST]:       'a hotel guest staying at the property',
    [AccountRole.HOTEL_OWNER]: 'the hotel owner',
    [AccountRole.HOTEL_STAFF]: 'a member of the hotel staff',
    [AccountRole.ADMIN]:       'an admin user of the platform',
  };
  return map[role as AccountRole] ?? 'a user';
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
  isVoice?: boolean,
): Promise<{ contextData: { context: string; lastMessageCount: number }; instructions: ChatMessageInput[]; instructionsWithoutRole: string }> {
  const contextData = await chatContextService.buildChatContext(chatId);

  let systemContent = `You are ${appName}, a hotel companion that helps with anything related to the hotel operations.

  ${llmInstructions?.length > 0 ? `Hotel-specific instructions:\n${llmInstructions.trim()}` : ''}

Use your tools when helpful and help the user to your best ability.

IMPORTANT: In a multi-turn interaction, if you have already provided the requested information in a previous turn, do not repeat it or add redundant follow-up signatures like "Is there anything else I can help with?". Be concise and direct. Avoid generic pleasantries if they have already been said.

${isVoice ? `This interaction is happening over voice. Respond in 1-2 very short, natural-sounding sentences that are easy to speak and understand aloud. Avoid long paragraphs, any kind of formatting` : 'Always respond in Markdown.'}`;

  const parts: string[] = [systemContent];

  const roleDescription = describeSpeakerRole(speakerRole);
  parts.push(`For this session, the authenticated speaker is ${roleDescription}. Address them appropriately for that role.`);

  const ROLE_INSTRUCTIONS: Partial<Record<AccountRole, string>> = {
    [AccountRole.HOTEL_STAFF]:
      'You are assisting a hotel staff member. Your role is strictly limited to managing service requests: ' +
      'creating new requests, updating existing requests, checking pending requests, and appending notes to requests. ' +
      'Do not assist with any other topics, hotel information, menus, bookings, or guest queries.',
  };

  if (speakerRole && ROLE_INSTRUCTIONS[speakerRole]) {
    parts.push(ROLE_INSTRUCTIONS[speakerRole]);
  }

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

  const instructions: ChatMessageInput[] = parts.map((ele) => {
    return {
      role: 'system',
      content: ele,
    };
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
  isVoice?: boolean,
): Promise<ChatPromptResult> {
  const { contextData, instructions } = await buildSystemInstructions(chatContextService, chatId, appName, llmInstructions, speakerRole, languageCode, isVoice);

  const messages: ChatMessageInput[] = instructions;

  messages.push({
    role: 'user',
    content: userMessage,
  });

  return {
    contextData,
    messages,
  };
}
