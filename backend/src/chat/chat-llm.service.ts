import { Injectable, Logger } from '@nestjs/common';
import { MessagesService } from '../messages/messages.service';
import { Message, MessageRole } from '../messages/message.model';
import { ChatContextService } from '../chat-context/chat-context.service';
import { LangGraphService, ToolCallRecord as LangGraphToolCallRecord } from '../langgraph/langgraph.service';
import { ConstantsService } from '../common/constants/constants.service';
import { CostsService } from '../costs/costs.service';
import { CostType } from '../costs/costs.model';
import { ChatSession } from './gateway/chat-session.interface';
import { buildChatPrompt, buildReservationPrompt } from './chat-prompt.builder';
import { LlmEvalService } from '../llm-eval/llm-eval.service';
import { stripAudioTags } from '../common/sentence.util';

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
    private readonly llmEvalService: LlmEvalService,
  ) {}

  /** Booking chats carry the hotel on the booking; reservation chats carry it directly. */
  private resolveHotelId(session: ChatSession): number | null {
    if (session.booking && session.booking.hotelId) {
      return session.booking.hotelId;
    }
    return session.hotelId ?? null;
  }

  /**
   * Follow a language change on the live session, not just in the database.
   *
   * The row is what a later connection reads, but the voice speaking the rest of
   * this call reads session.languageCode — so without this a caller who switches
   * to Hindi keeps hearing English until they hang up and call back.
   */
  private syncSessionLanguageFromToolCalls(session: ChatSession, toolCalls: LangGraphToolCallRecord[]): void {
    for (const call of toolCalls) {
      if (call.toolName !== 'set_chat_language') {
        continue;
      }
      const code = (call.input as any)?.languageCode;
      if (typeof code === 'string' && code) {
        session.languageCode = code;
      }
    }
  }

  private syncSessionBookingFromToolCalls(session: ChatSession, toolCalls: LangGraphToolCallRecord[]): void {
    for (let i = 0; i < toolCalls.length; i += 1) {
      const call = toolCalls[i];
      if (call.toolName !== 'set_booking_context') {
        continue;
      }
      const outputRaw = call.output;
      if (typeof outputRaw !== 'string') {
        continue;
      }
      let parsed: any;
      try {
        parsed = JSON.parse(outputRaw);
      } catch {
        continue;
      }
      const data = parsed?.data;
      const bookingId = data?.bookingId;
      if (typeof bookingId !== 'number') {
        continue;
      }
      session.bookingId = bookingId;
      session.booking = data?.booking ?? null;
      session.hotel = data?.booking?.hotel ?? null;
    }
  }

  async streamUserMessage(session: ChatSession, userMessage: string, options: StreamUserMessageOptions): Promise<void> {
    const chatId = session.chatId;

    const userMsg = await this.messagesService.create(chatId, MessageRole.USER, userMessage);

    const appName = this.constantsService.public.APP_NAME;
    const hotel: any = session.hotel;
    const llmInstructions = hotel && hotel.llmInstructions ? hotel.llmInstructions : null;
    const isVoice = options.mode === 'voice';
    // No account means the public reservation agent: a different prompt, a
    // different tool set, and a hotel it may never step outside of.
    const isReservation = !session.account;

    const { messages } = isReservation
      ? await buildReservationPrompt(this.chatContextService, chatId, userMessage, appName, session.hotel, isVoice, session.languageCode ?? null)
      : await buildChatPrompt(
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
      hotelId: session.hotelId ?? null,
      bookingId: session.bookingId,
      chatId: session.chatId,
      hotel: session.hotel,
      booking: session.booking,
      languageCode: session.languageCode ?? null,
      sourceMessageId: userMsg.id,
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

    // Delivery cues are instructions to a voice, not words. They are stripped
    // from what anyone reads — a guest should hear the warmth and never see
    // "[warm]" in their transcript — and kept verbatim alongside, so a reply
    // that sounded wrong can still be explained afterwards.
    const readable = stripAudioTags(fullContent);
    const assistantMessage: Message = await this.messagesService.create(
      chatId,
      MessageRole.ASSISTANT,
      readable,
      toolCalls.length ? toolCalls : undefined,
      fullContent,
    );

    this.chatContextService.rebuildCache(chatId, [userMsg, assistantMessage]);

    this.syncSessionBookingFromToolCalls(session, toolCalls);
    this.syncSessionLanguageFromToolCalls(session, toolCalls);

    this.costsService.recordLlmCost({
      // This same LangGraph call path serves both text chat and the "custom"
      // STT+LLM+TTS voice pipeline (mode: 'voice') — tag voice turns as LLM_VOICE
      // so channel-level cost reporting isn't silently folded into chat spend.
      type: isVoice ? CostType.LLM_VOICE : CostType.LLM_CHAT,
      usage: {
        promptTokens: usage && usage.promptTokens ? usage.promptTokens : 0,
        completionTokens: usage && usage.completionTokens ? usage.completionTokens : 0,
        totalTokens: usage && usage.totalTokens ? usage.totalTokens : 0,
      },
      bookingId: session.bookingId,
      hotelId: this.resolveHotelId(session),
      accountId: session.account ? session.account.id : null,
      role: session.account ? session.account.role : null,
      chatId: session.chatId,
      messageId: assistantMessage.id,
    });

    this.llmEvalService.maybeEvaluate({
      chatId: session.chatId,
      messageId: assistantMessage.id,
      userMessage,
      assistantMessage: fullContent,
      toolCalls,
      accountId: session.account ? session.account.id : null,
      role: session.account ? session.account.role : null,
      hotelId: this.resolveHotelId(session),
      bookingId: session.bookingId,
    });

    if (options.onEnd) {
      await options.onEnd({ fullContent, toolCalls });
    }
  }
}

