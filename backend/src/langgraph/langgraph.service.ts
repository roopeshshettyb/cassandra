import { Injectable } from '@nestjs/common';
import { BaseMessage, HumanMessage, SystemMessage, AIMessage, AIMessageChunk, ToolMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { createAgent } from 'langchain';
import { createAgentTools } from './langgraph.tools';
import { AgentToolContext } from './langgraph-tools.context';
import { BookingsService } from '../bookings/bookings.service';
import { RequestsService } from '../requests/requests.service';
import { RestaurantService } from '../restaurant/restaurant.service';
import { ChatService } from '../chat/chat.service';
import { LlmService } from '../chat/llm.service';

export interface ToolCallRecord {
  toolName: string;
  toolCallId: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
}

export interface ChatMessageInput {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface StreamInput {
  messages: ChatMessageInput[];
  systemContext?: string;
}

@Injectable()
export class LangGraphService {
  private readonly outputParser = new StringOutputParser();

  constructor(
    private readonly bookingsService: BookingsService,
    private readonly requestsService: RequestsService,
    private readonly restaurantService: RestaurantService,
    private readonly chatService: ChatService,
    private readonly llmService: LlmService,
  ) {}

  private createModel() {
    return this.llmService.getModel();
  }

  private parseMessages(messages: ChatMessageInput[]): BaseMessage[] {
    return messages
      .filter((msg) => !!msg && !!msg.content)
      .map((msg) => {
        if (msg.role === 'user') return new HumanMessage(msg.content);
        if (msg.role === 'assistant') return new AIMessage(msg.content);
        return new SystemMessage(msg.content);
      });
  }

  private extractToolCalls(messages: BaseMessage[]): ToolCallRecord[] {
    const toolResults = new Map<string, { output?: unknown; error?: string }>();
    for (const msg of messages) {
      if (!msg) continue;
      if (msg instanceof ToolMessage) {
        toolResults.set(msg.tool_call_id ?? '', {
          output: msg.content,
          error: undefined,
        });
      }
    }
    const toolCalls: ToolCallRecord[] = [];
    for (const msg of messages) {
      if (!msg) continue;
      if ((msg instanceof AIMessage || msg instanceof AIMessageChunk) && msg.tool_calls?.length) {
        for (const tc of msg.tool_calls) {
          const id = tc.id ?? '';
          const result = toolResults.get(id);
          toolCalls.push({
            toolName: tc.name ?? '',
            toolCallId: id,
            input: (tc.args as Record<string, unknown>) ?? {},
            output: result?.output,
            error: result?.error,
          });
        }
      }
    }
    return toolCalls;
  }

  async *stream(
    input: StreamInput,
    ctx: AgentToolContext,
  ): AsyncGenerator<string | { toolCalls: ToolCallRecord[]; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } }, void, unknown> {
    const messages = this.parseMessages(input.messages);
    const tools = createAgentTools(ctx, this.bookingsService, this.requestsService, this.restaurantService, this.chatService);
    const model = this.createModel();
    const agent = createAgent({ model, tools });

    const threadId = `thread-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let lastResult: { messages?: BaseMessage[] } | null = null;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    const state: any = { messages };
    const eventStream = agent.streamEvents(state, { version: 'v2', configurable: { thread_id: threadId } });

    for await (const event of eventStream) {
      if (event.event === 'on_chat_model_stream' && event.data?.chunk) {
        const parsed = await this.outputParser.invoke(event.data.chunk);
        if (parsed) yield parsed;
      }
      if (event.event === 'on_chat_model_end' && event.data?.output) {
        const output = event.data.output;
        const maybeUsage = output.usage_metadata as
          | { input_tokens?: number; output_tokens?: number; total_tokens?: number }
          | undefined;
        if (maybeUsage) {
          totalPromptTokens += maybeUsage.input_tokens ?? 0;
          totalCompletionTokens += maybeUsage.output_tokens ?? 0;
        }
      }
      if (event.event === 'on_chain_end' && event.data?.output) {
        lastResult = event.data.output as { messages?: BaseMessage[] };
      }
    }

    if (lastResult?.messages?.length) {
      const toolCalls = this.extractToolCalls(lastResult.messages);
      const usage: { promptTokens: number; completionTokens: number; totalTokens: number } = {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
      };
      yield { toolCalls, usage };
    }
  }
}


