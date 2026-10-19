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
  /** Reservation notes still being written, by chat; the next turn there waits for them. */
  private readonly notesInFlight = new Map<number, Promise<void>>();

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

  /** Record what a turn cost, under the message it produced. */
  private recordCost(
    session: ChatSession,
    isVoice: boolean,
    messageId: number,
    usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null,
    model?: { name: string; inputPricePer1K: number; outputPricePer1K: number },
  ): void {
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
      messageId,
      model,
    });
  }

  async streamUserMessage(session: ChatSession, userMessage: string, options: StreamUserMessageOptions): Promise<void> {
    const chatId = session.chatId;
    // A reservation turn is built on the notes, so it waits for the last turn's.
    await this.notesInFlight.get(chatId);

    const userMsg = await this.messagesService.create(chatId, MessageRole.USER, userMessage);

    const appName = this.constantsService.public.APP_NAME;
    const hotel: any = session.hotel;
    const llmInstructions = hotel && hotel.llmInstructions ? hotel.llmInstructions : null;
    const isVoice = options.mode === 'voice';
    // No account means the public reservation agent: a different prompt, a
    // different tool set, and a hotel it may never step outside of.
    const isReservation = !session.account;

    // A reservation turn is built on the whole call so far — less the message
    // just saved, which is the turn itself — and on what has been noted.
    const reservation = this.constantsService.private.RESERVATION;
    const [history, notes] = isReservation
      ? await Promise.all([
          this.messagesService.findRecentByChatId(chatId, reservation.HISTORY_MESSAGE_LIMIT + 1),
          this.messagesService.currentNotesByChatId(chatId, reservation.SCRATCHPAD_NOTE_LIMIT),
        ])
      : [[], []];
    const { messages, scribePrompt } = isReservation
      ? buildReservationPrompt(
          history.filter((message) => message.id !== userMsg.id),
          userMessage, appName, session.hotel, isVoice, session.languageCode ?? null, notes,
        )
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
      sourceText: userMessage,
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

    // Delivery cues are instructions to a voice, not words: a guest should hear
    // the warmth and never see "[warm]" in their transcript. Only the reservation
    // voice prompt asks for them, and stripping anywhere else would eat Markdown
    // link text.
    const assistantMessage: Message = await this.messagesService.create(
      chatId,
      MessageRole.ASSISTANT,
      isReservation && isVoice ? stripAudioTags(fullContent) : fullContent,
      toolCalls.length ? toolCalls : undefined,
    );

    // The reservation agent reads the call itself, not this cache.
    if (!isReservation) {
      this.chatContextService.rebuildCache(chatId, [userMsg, assistantMessage]);
    }

    this.syncSessionBookingFromToolCalls(session, toolCalls);

    this.recordCost(session, isVoice, assistantMessage.id, usage);

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

    // Written down once the caller has their answer, and kept with the turn so
    // the hotel's view of the call shows what was noted when.
    if (scribePrompt) {
      const writing = this.langGraphService.writeNotes(scribePrompt(stripAudioTags(fullContent)), toolContext).then(async ({ calls, tokens }) => {
        if (calls.length) {
          await assistantMessage.update({ toolCalls: [...toolCalls, ...calls] });
        }
        const notes = this.constantsService.private.LLM.RESERVATION_NOTES;
        this.recordCost(session, isVoice, assistantMessage.id, { promptTokens: tokens[0], completionTokens: tokens[1], totalTokens: tokens[0] + tokens[1] }, {
          name: notes.MODEL,
          inputPricePer1K: notes.INPUT_PRICE_PER_1K,
          outputPricePer1K: notes.OUTPUT_PRICE_PER_1K,
        });
      }).catch((err: any) => this.logger.warn({ message: err?.message ?? String(err), serviceName: ChatLlmService.name, actionName: 'writeNotes' }));
      this.notesInFlight.set(chatId, writing);
      void writing.finally(() => this.notesInFlight.get(chatId) === writing && this.notesInFlight.delete(chatId));
    }
  }
}

