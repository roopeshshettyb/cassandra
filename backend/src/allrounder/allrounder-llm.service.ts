import { Injectable, Inject } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { createAgent } from 'langchain';
import { BaseMessage, HumanMessage, AIMessage, SystemMessage, AIMessageChunk, ToolMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ConstantsService } from '../common/constants/constants.service';
import { HotelsService } from '../hotels/hotels.service';
import { RequestsService } from '../requests/requests.service';
import { BookingsService } from '../bookings/bookings.service';
import { Booking } from '../bookings/bookings.model';
import { BOOKINGS_REPOSITORY } from '../bookings/bookings.repository';
import { CostsService } from '../costs/costs.service';
import { CostType } from '../costs/costs.model';
import { AllRounderSession } from './allrounder-session.interface';
import { AllRounderToolContext, AgentCard } from './allrounder-tool.context';
import { AllRounderToolDeps, createAllRounderTools } from './allrounder.tools';
import { buildAllRounderPrompt } from './allrounder-prompt.builder';
import { AllRounderChatService } from './allrounder-chat.service';
import { AllRounderMessageRole, AllRounderToolCallRecord } from './allrounder-message.model';
import { ToolCallRecord } from '../langgraph/langgraph.service';

export interface AllRounderStreamOptions {
  onChunk: (chunk: string) => Promise<void> | void;
  onEnd?: (result: { fullContent: string; toolCalls: ToolCallRecord[]; cards: AgentCard[] }) => Promise<void> | void;
  mode?: 'text' | 'voice';
}

@Injectable()
export class AllRounderLlmService {
  private readonly outputParser = new StringOutputParser();

  constructor(
    private readonly constantsService: ConstantsService,
    private readonly hotelsService: HotelsService,
    private readonly requestsService: RequestsService,
    private readonly bookingsService: BookingsService,
    private readonly allRounderChatService: AllRounderChatService,
    private readonly costsService: CostsService,
    @Inject(BOOKINGS_REPOSITORY) private readonly bookingsRepository: typeof Booking,
  ) {}

  private createModel(): ChatOpenAI {
    const llmConfig = this.constantsService.private.LLM;
    return new ChatOpenAI({
      modelName: llmConfig.TEXT_MODEL,
      apiKey: llmConfig.OPENROUTER.API_KEY,
      temperature: 0.7,
      configuration: { baseURL: llmConfig.OPENROUTER.BASE_URL },
    });
  }

  private parseMessages(messages: Array<{ role: string; content: string }>): BaseMessage[] {
    return messages.map((msg) => {
      if (msg.role === 'user') return new HumanMessage(msg.content);
      if (msg.role === 'assistant') return new AIMessage(msg.content);
      return new SystemMessage(msg.content);
    });
  }

  private extractToolCalls(messages: BaseMessage[]): ToolCallRecord[] {
    const toolResults = new Map<string, unknown>();
    for (const msg of messages) {
      if (msg instanceof ToolMessage) {
        toolResults.set(msg.tool_call_id ?? '', msg.content);
      }
    }
    const toolCalls: ToolCallRecord[] = [];
    for (const msg of messages) {
      if ((msg instanceof AIMessage || msg instanceof AIMessageChunk) && msg.tool_calls?.length) {
        for (const tc of msg.tool_calls) {
          const id = tc.id ?? '';
          toolCalls.push({
            toolName: tc.name ?? '',
            toolCallId: id,
            input: (tc.args as Record<string, unknown>) ?? {},
            output: toolResults.get(id),
          });
        }
      }
    }
    return toolCalls;
  }

  private extractCards(toolCalls: ToolCallRecord[]): AgentCard[] {
    const cards: AgentCard[] = [];
    for (const tc of toolCalls) {
      if (!tc.output) continue;
      let parsed: any;
      try {
        parsed = typeof tc.output === 'string' ? JSON.parse(tc.output) : tc.output;
      } catch {
        continue;
      }

      const items: any[] = Array.isArray(parsed) ? parsed : parsed?.stats ? parsed.stats : [];
      for (const item of items) {
        if (!item._card_type) continue;
        if (item._card_type === 'request') {
          const roomPart = item.roomNumber ? ` · Room ${item.roomNumber}` : '';
          cards.push({
            type: 'request',
            title: `${String(item.requestType ?? '').replace(/_/g, ' ')} — ${item.guestName ?? 'Guest'}`,
            subtitle: `${item.hotelName ?? ''}${roomPart}` || undefined,
            badge: item.urgency ?? undefined,
            route: `/requests/${item.id}`,
            meta: { status: item.status, urgency: item.urgency, requestId: item.id },
          });
        } else if (item._card_type === 'booking') {
          const checkIn = item.startTime ? new Date(item.startTime).toLocaleDateString() : '';
          cards.push({
            type: 'booking',
            title: item.guestName ?? `Room ${item.roomNumber}`,
            subtitle: `Room ${item.roomNumber} · ${checkIn}`,
            route: `/bookings/${item.id}`,
            meta: { bookingId: item.id },
          });
        } else if (item._card_type === 'hotel') {
          cards.push({
            type: 'hotel',
            title: item.name,
            subtitle: item.address ?? undefined,
            route: `/hotels/${item.id}`,
            meta: { hotelId: item.id },
          });
        } else if (item._card_type === 'stat') {
          cards.push({
            type: 'stat',
            title: String(item.value ?? ''),
            subtitle: item.label ?? undefined,
            meta: {},
          });
        }
      }
    }
    return cards;
  }

  async streamUserMessage(session: AllRounderSession, userMessage: string, options: AllRounderStreamOptions): Promise<void> {
    const appName = this.constantsService.public.APP_NAME;
    const isVoice = options.mode === 'voice';

    // Build context from DB history
    const recentMessages = await this.allRounderChatService.getRecentMessages(session.chatId, 20);
    const context = this.allRounderChatService.buildContextString(recentMessages);

    const promptMessages = buildAllRounderPrompt(context, session, userMessage, appName, isVoice);

    const ctx: AllRounderToolContext = { account: session.account, scopedHotelIds: session.scopedHotelIds };
    const toolDeps: AllRounderToolDeps = {
      hotelsService: this.hotelsService,
      requestsService: this.requestsService,
      bookingsService: this.bookingsService,
      costsService: this.costsService,
      bookingsRepository: this.bookingsRepository,
    };

    const tools = createAllRounderTools(ctx, toolDeps);
    const model = this.createModel();
    const agent = createAgent({ model, tools });

    const threadId = `allrounder-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let lastResult: { messages?: BaseMessage[] } | null = null;
    let fullContent = '';
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    const parsedMessages = this.parseMessages(promptMessages);
    const state: any = { messages: parsedMessages };
    const eventStream = agent.streamEvents(state, { version: 'v2', configurable: { thread_id: threadId } });

    for await (const event of eventStream) {
      if (event.event === 'on_chat_model_stream' && event.data?.chunk) {
        const parsed = await this.outputParser.invoke(event.data.chunk);
        if (parsed) {
          fullContent += parsed;
          await options.onChunk(parsed);
        }
      }
      if (event.event === 'on_chat_model_end' && event.data?.output) {
        const maybeUsage = event.data.output.usage_metadata as { input_tokens?: number; output_tokens?: number } | undefined;
        if (maybeUsage) {
          totalPromptTokens += maybeUsage.input_tokens ?? 0;
          totalCompletionTokens += maybeUsage.output_tokens ?? 0;
        }
      }
      if (event.event === 'on_chain_end' && event.data?.output) {
        lastResult = event.data.output as { messages?: BaseMessage[] };
      }
    }

    const toolCalls = lastResult?.messages?.length ? this.extractToolCalls(lastResult.messages) : [];
    const cards = this.extractCards(toolCalls);

    // Persist messages to DB
    await this.allRounderChatService.saveMessage(session.chatId, AllRounderMessageRole.USER, userMessage);
    const assistantMessage = await this.allRounderChatService.saveMessage(
      session.chatId,
      AllRounderMessageRole.ASSISTANT,
      fullContent,
      toolCalls.length ? (toolCalls as AllRounderToolCallRecord[]) : undefined,
    );

    // Record cost
    this.costsService.recordLlmCost({
      type: CostType.LLM_CHAT,
      usage: {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
      },
      bookingId: null,
      hotelId: null,
      accountId: session.account.id,
      role: session.account.role,
      chatId: assistantMessage.id,
      messageId: assistantMessage.id,
    });

    if (options.onEnd) {
      await options.onEnd({ fullContent, toolCalls, cards });
    }
  }
}
