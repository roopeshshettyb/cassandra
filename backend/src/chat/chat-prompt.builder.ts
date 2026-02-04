import { ChatContextService } from '../chat-context/chat-context.service';
import { ChatMessageInput } from '../langgraph/langgraph.service';

export interface ChatPromptResult {
  contextData: { context: string; lastMessageCount: number };
  messages: ChatMessageInput[];
}

/**
 * Build the shared Cassandra system instructions and conversational context
 * string for a given chat. This is suitable for passing to
 * `session.instructions` in the Realtime API.
 */
export async function buildSystemInstructions(
  chatContextService: ChatContextService,
  chatId: number,
): Promise<{ contextData: { context: string; lastMessageCount: number }; instructions: string }> {
  const contextData = await chatContextService.buildChatContext(chatId);

  const systemContent = `You are Cassandra
    
  You are a hotel companion that lives with a guest in the hotel.
   
  Use your tools when helpful and help the user to your best ability.

  Always respond in Markdown.`;

  const parts: string[] = [
    systemContent,
    `This is the context of the coversation so far : ${contextData.context}`,
  ];

  const instructions = parts.join('\n\n');

  return {
    contextData,
    instructions,
  };
}

/**
 * Build the shared Cassandra system instructions and conversational context
 * for a given chat, plus the current user message.
 *
 * This helper is reused for both text (`/chat`) and voice (`/voice`) flows
 * that rely on LangGraph.
 */
export async function buildChatPrompt(
  chatContextService: ChatContextService,
  chatId: number,
  userMessage: string,
): Promise<ChatPromptResult> {
  const { contextData, instructions } = await buildSystemInstructions(chatContextService, chatId);

  // In the future this can include attachment-derived content as well.
  const textContents: string[] = [];

  const messages: ChatMessageInput[] = [
    { role: 'system', content: instructions },
  ];

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

