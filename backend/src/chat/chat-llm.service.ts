import { Injectable, Logger } from '@nestjs/common';
import { MessagesService } from '../messages/messages.service';
import { Message, MessageRole } from '../messages/message.model';
import { ChatContextService } from '../chat-context/chat-context.service';
import { LangGraphService, ToolCallRecord as LangGraphToolCallRecord } from '../langgraph/langgraph.service';
import { ConstantsService } from '../common/constants/constants.service';
import { CostsService } from '../costs/costs.service';
import { CostType } from '../costs/costs.model';
import { ChatSession } from './gateway/chat-session.interface';
import { buildChatPrompt } from './chat-prompt.builder';

export interface StreamUserMessageOptions {
  onChunk: (chunk: string) => Promise<void> | void;
  onEnd?: (result: { fullContent: string; toolCalls: LangGraphToolCallRecord[] }) => Promise<void> | void;
  mode?: 'text' | 'voice';
}

@Injectable()
export class ChatLlmService {
  private readonly logger = new Logger(ChatLlmService.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly chatContextService: ChatContextService,
    private readonly langGraphService: LangGraphService,
    private readonly constantsService: ConstantsService,
    private readonly costsService: CostsService,
  ) {}

  async streamUserMessage(session: ChatSession, userMessage: string, options: StreamUserMessageOptions): Promise<void> {
    const chatId = session.chatId;

    await this.messagesService.create(chatId, MessageRole.USER, userMessage);

    const appName = this.constantsService.public.APP_NAME;
    const hotel: any = session.hotel;
    const llmInstructions = hotel && hotel.llmInstructions ? hotel.llmInstructions : null;
    const isVoice = options.mode === 'voice';

    const { messages } = await buildChatPrompt(
      this.chatContextService,
      chatId,
      userMessage,
      appName,
      session.account?.role,
      llmInstructions,
      session.languageCode ?? null,
      isVoice,
    );

    const toolContext = {
      account: session.account,
      bookingId: session.bookingId,
      chatId: session.chatId,
      hotel: session.hotel,
      booking: session.booking,
      languageCode: session.languageCode ?? null,
    };

    let fullContent = '';
    let toolCalls: LangGraphToolCallRecord[] = [];
    let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null = null;

    for await (const chunk of this.langGraphService.stream({ messages }, toolContext)) {
      if (typeof chunk === 'string') {
        fullContent += chunk;
        await options.onChunk(chunk);
      } else if (chunk && typeof chunk === 'object') {
        if ('toolCalls' in chunk) {
          toolCalls = (chunk as { toolCalls: LangGraphToolCallRecord[] }).toolCalls;
        }
        if ('usage' in chunk && (chunk as { usage?: unknown }).usage) {
          const u = (chunk as { usage: { promptTokens: number; completionTokens: number; totalTokens: number } }).usage;
          usage = u;
        }
      }
    }

    const assistantMessage: Message = await this.messagesService.create(
      chatId,
      MessageRole.ASSISTANT,
      fullContent,
      toolCalls.length ? toolCalls : undefined,
    );

    await this.chatContextService.rebuildCache(chatId);

    this.costsService.recordLlmCost({
      type: CostType.LLM_CHAT,
      usage: {
        promptTokens: usage && usage.promptTokens ? usage.promptTokens : 0,
        completionTokens: usage && usage.completionTokens ? usage.completionTokens : 0,
        totalTokens: usage && usage.totalTokens ? usage.totalTokens : 0,
      },
      bookingId: session.bookingId,
      hotelId: session.booking && session.booking.hotelId ? session.booking.hotelId : null,
      accountId: session.account.id,
      role: session.account.role,
      chatId: session.chatId,
      messageId: assistantMessage.id,
    });

    if (options.onEnd) {
      await options.onEnd({ fullContent, toolCalls });
    }
  }
}

