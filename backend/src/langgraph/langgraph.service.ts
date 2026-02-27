import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { BaseMessage, HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { createAgentTools } from './langgraph.tools';
import { AgentToolContext } from './langgraph-tools.context';
import { BookingsService } from '../bookings/bookings.service';
import { RequestsService } from '../requests/requests.service';
import { RestaurantService } from '../restaurant/restaurant.service';
import { ChatService } from '../chat/chat.service';
import { ConstantsService } from '../common/constants/constants.service';

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
  private readonly logger = new Logger(LangGraphService.name);

  private extractText(content: any): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      let text = '';
      for (const block of content) {
        if (typeof block === 'string') text += block;
        else if (block?.type === 'text' && typeof block.text === 'string') text += block.text;
      }
      return text;
    }
    return '';
  }

  constructor(
    private readonly bookingsService: BookingsService,
    private readonly requestsService: RequestsService,
    private readonly restaurantService: RestaurantService,
    private readonly chatService: ChatService,
    private readonly constantsService: ConstantsService,
  ) {}

  private createModel(): ChatOpenAI {
    const llmConfig = this.constantsService.private.LLM;
    const openrouterConfig = llmConfig.OPENROUTER;
    const apiKey = openrouterConfig.API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is required');
    }
    return new ChatOpenAI({
      modelName: llmConfig.TEXT_MODEL,
      apiKey,
      temperature: 0.7,
      configuration: {
        baseURL: openrouterConfig.BASE_URL,
      },
    });
  }

  private parseMessages(messages: ChatMessageInput[]): BaseMessage[] {
    const result: BaseMessage[] = [];
    for (const msg of messages) {
      if (msg.role === 'user') {
        result.push(new HumanMessage(msg.content));
      } else if (msg.role === 'assistant') {
        result.push(new AIMessage(msg.content));
      } else {
        result.push(new SystemMessage(msg.content));
      }
    }
    return result;
  }

  async *stream(
    input: StreamInput,
    ctx: AgentToolContext,
  ): AsyncGenerator<string | { toolCalls: ToolCallRecord[]; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } }, void, unknown> {
    const allMessages: BaseMessage[] = this.parseMessages(input.messages);
    const tools = createAgentTools(ctx, this.bookingsService, this.requestsService, this.restaurantService, this.chatService);
    const model = this.createModel();
    const modelWithTools: any = model.bindTools(tools);

    const toolCallRecords: ToolCallRecord[] = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    // Tool-calling loop: invoke → execute tools → repeat until no more tool calls
    for (let iter = 0; iter < 5; iter++) {
      this.logger.log(`[LLM] invoke iter=${iter} model=${this.constantsService.private.LLM.TEXT_MODEL}`);
      let response: any;
      try {
        response = await modelWithTools.invoke(allMessages);
      } catch (err: any) {
        this.logger.error(`[LLM] invoke failed: ${err?.message ?? err}`);
        throw err;
      }

      this.logger.log(`[LLM] response content type=${typeof response?.content} tool_calls=${response?.tool_calls?.length ?? 0}`);

      const usageMeta = response?.usage_metadata;
      if (usageMeta) {
        totalPromptTokens += usageMeta.input_tokens ?? 0;
        totalCompletionTokens += usageMeta.output_tokens ?? 0;
      }

      allMessages.push(response);

      const pendingToolCalls: any[] = response?.tool_calls ?? [];

      if (!pendingToolCalls.length) {
        // No tool calls — this is the final answer, yield the text
        const text = this.extractText(response?.content);
        this.logger.log(`[LLM] final text length=${text.length}`);
        if (text) yield text;
        break;
      }

      // Execute each tool call
      for (const tc of pendingToolCalls) {
        const tool = tools.find((t) => t.name === tc.name);
        let output = '';
        let error: string | undefined;
        try {
          output = tool ? String(await tool.invoke(tc.args)) : JSON.stringify({ error: `Unknown tool: ${tc.name}` });
        } catch (e: any) {
          error = e?.message ?? 'Tool error';
          output = JSON.stringify({ error });
        }
        allMessages.push(new ToolMessage({ content: output, tool_call_id: tc.id ?? '' }));
        toolCallRecords.push({
          toolName: tc.name ?? '',
          toolCallId: tc.id ?? '',
          input: (tc.args as Record<string, unknown>) ?? {},
          output,
          error,
        });
      }
    }

    yield {
      toolCalls: toolCallRecords,
      usage: {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
      },
    };
  }
}
