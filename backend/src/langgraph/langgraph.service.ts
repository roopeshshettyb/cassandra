import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { createAgent } from 'langchain';
import { BaseMessage, HumanMessage, SystemMessage, AIMessage, AIMessageChunk, ToolMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';
import OpenAI from 'openai';
import { createAgentTools } from './langgraph.tools';
import { createReservationTools } from './reservation.tools';
import { AgentToolContext } from './langgraph-tools.context';
import { BookingsService } from '../bookings/bookings.service';
import { RequestsService } from '../requests/requests.service';
import { RestaurantService } from '../restaurant/restaurant.service';
import { ChatService } from '../chat/chat.service';
import { MessagesService } from '../messages/messages.service';
import { HotelsService } from '../hotels/hotels.service';
import { ConstantsService } from '../common/constants/constants.service';

export interface ExtractedBookingFields {
  startDate?: string | null;
  endDate?: string | null;
  guestEmail?: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
  roomNumber?: string | null;
  hotelName?: string | null;
}

const EXTRACT_BOOKING_SCHEMA = z.object({
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  guestEmail: z.string().nullable().optional(),
  guestName: z.string().nullable().optional(),
  guestPhone: z.string().nullable().optional(),
  roomNumber: z.string().nullable().optional(),
  hotelName: z.string().nullable().optional(),
});

/** JSON schema for OpenAI Responses API, inferred from EXTRACT_BOOKING_SCHEMA. */
const EXTRACT_BOOKING_JSON_SCHEMA = (() => {
  const base = EXTRACT_BOOKING_SCHEMA.toJSONSchema() as Record<string, unknown>;
  const { $schema: _, ...rest } = base;
  return {
    ...rest,
    required: Object.keys(EXTRACT_BOOKING_SCHEMA.shape),
  };
})();

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
    @Inject(forwardRef(() => BookingsService))
    private readonly bookingsService: BookingsService,
    private readonly requestsService: RequestsService,
    private readonly restaurantService: RestaurantService,
    private readonly chatService: ChatService,
    private readonly messagesService: MessagesService,
    @Inject(forwardRef(() => HotelsService))
    private readonly hotelsService: HotelsService,
    private readonly constantsService: ConstantsService,
  ) {}

  createModel(temperature = 0, modelName?: string): ChatOpenAI {
    const llmConfig = this.constantsService.private.LLM;
    return new ChatOpenAI({
      modelName: modelName ?? llmConfig.TEXT_MODEL,
      apiKey: llmConfig.OPENROUTER.API_KEY,
      temperature,
      modelKwargs: { provider: llmConfig.OPENROUTER.PROVIDER },
      configuration: { baseURL: llmConfig.OPENROUTER.BASE_URL },
    });
  }

  async invoke(messages: BaseMessage[], temperature = 0): Promise<string> {
    const result = await this.createModel(temperature).invoke(messages);
    return result.content as string;
  }

  async invokeWithStructuredOutput<T>(schema: z.ZodType<T>, messages: BaseMessage[], schemaName?: string, temperature = 0): Promise<T> {
    const result = await this.createModel(temperature).withStructuredOutput(schema, { name: schemaName }).invoke(messages);
    return result as T;
  }

  /** OCR + extract structured data from one or more image URLs via OpenRouter vision model. */
  async extractFromImageUrlsWithStructuredOutput<T>(
    schema: z.ZodType<T>,
    prompt: string,
    imageUrls: string[],
    schemaName?: string,
  ): Promise<T> {
    const llmConfig = this.constantsService.private.LLM;
    const model = new ChatOpenAI({
      modelName: llmConfig.MENU_OCR_MODEL,
      apiKey: llmConfig.OPENROUTER.API_KEY,
      temperature: 0,
      configuration: { baseURL: llmConfig.OPENROUTER.BASE_URL },
    });
    const content: any[] = [{ type: 'text', text: prompt }];
    for (let i = 0; i < imageUrls.length; i++) {
      content.push({ type: 'image_url', image_url: { url: imageUrls[i] } });
    }
    const message = new HumanMessage({ content });
    const structured = model.withStructuredOutput(schema, { name: schemaName });
    const result = await structured.invoke([message]);
    return result as T;
  }

  private createVisionModel(): ChatOpenAI {
    const openaiConfig = this.constantsService.private?.LLM?.STT_CONFIG?.OPENAI;
    const apiKey = openaiConfig?.API_KEY;
    const model = openaiConfig?.VISION_MODEL;
    if (!apiKey || !model) {
      throw new Error('OpenAI API key and VISION_MODEL are required for document extraction');
    }
    return new ChatOpenAI({
      modelName: model,
      apiKey,
      temperature: 0,
    });
  }

  /** Extract booking fields from an image URL (Chat Completions vision; images only). */
  async extractBookingFromDocumentUrl(documentUrl: string): Promise<ExtractedBookingFields> {
    const prompt = this.constantsService.private.DOC_EXTRACTION_PROMPT;
    const visionModel = this.createVisionModel();
    const structuredModel = visionModel.withStructuredOutput(EXTRACT_BOOKING_SCHEMA, { method: 'jsonMode' });
    const message = new HumanMessage({
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: documentUrl } },
      ],
    });
    const result = await structuredModel.invoke([message]);
    const raw: any = result;
    return raw;
  }

  /**
   * Extract booking fields from a PDF URL using OpenAI Responses API (input_file with file_url).
   * Use this for PDFs; use extractBookingFromDocumentUrl for images.
   */
  async extractBookingFromPdfUrl(pdfUrl: string): Promise<ExtractedBookingFields> {
    const openaiConfig = this.constantsService.private?.LLM?.STT_CONFIG?.OPENAI;
    const apiKey = openaiConfig?.API_KEY;
    const model = openaiConfig?.VISION_MODEL;
    if (!apiKey || !model) {
      throw new Error('OpenAI API key and VISION_MODEL are required for document extraction');
    }
    const prompt = this.constantsService.private.DOC_EXTRACTION_PROMPT;
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model,
      input: [
        {
          type: 'message',
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_file', file_url: pdfUrl },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'extracted_booking',
          description: 'Extracted booking/reservation fields from the document.',
          schema: EXTRACT_BOOKING_JSON_SCHEMA,
          strict: true,
        },
      },
    });
    const raw = JSON.parse(response.output_text || '{}') as Record<string, string | null | undefined>;
    return raw;
  }

  private parseMessages(messages: ChatMessageInput[]): BaseMessage[] {
    return messages.map((msg) => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content);
      }
      if (msg.role === 'assistant') {
        return new AIMessage(msg.content);
      }
      return new SystemMessage(msg.content);
    });
  }

  private extractToolCalls(messages: BaseMessage[]): ToolCallRecord[] {
    const toolResults = new Map<string, { output?: unknown; error?: string }>();
    for (const msg of messages) {
      if (msg instanceof ToolMessage) {
        toolResults.set(msg.tool_call_id ?? '', {
          output: typeof msg.content === 'string' ? msg.content : msg.content,
          error: undefined,
        });
      }
    }
    const toolCalls: ToolCallRecord[] = [];
    for (const msg of messages) {
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
    // No account means the public reservation agent, which gets its own
    // read-only tool set rather than a role-filtered slice of the staff one.
    const tools = ctx.account
      ? createAgentTools(ctx, this.bookingsService, this.requestsService, this.restaurantService, this.chatService, this.hotelsService, this.constantsService)
      : createReservationTools(ctx, this.restaurantService, this.constantsService, this.chatService, this.messagesService);
    const model = this.createModel(0.7);
    const agent = createAgent({ model, tools });

    const threadId = `thread-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let lastResult: { messages?: BaseMessage[] } | null = null;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    const state: any = { messages };
    // The reservation turn can be ended where it stands. Measured: the model
    // speaks its reply and calls a tool in the same breath, then has nothing
    // left to say and calls tools again and again until the step cap — a minute
    // of silence when each call is slow. So once a reply has been spoken and the
    // tools asked for alongside it are done, the turn is over; and a tool can
    // end it too. Tool calls are recorded as they finish, so a turn ended early
    // still knows what it did.
    const ender = new AbortController();
    ctx.endTurn = () => ender.abort();
    const finished: ToolCallRecord[] = [];
    let endedEarly = false;
    let repliedWithTools = false;
    let spoke = false;
    // The reservation agent is capped: a tool the model keeps re-reading because
    // the answer did not change otherwise loops until the turn dies. Measured,
    // get_notes was called ten times in a row on one turn. The concierge keeps
    // the library default — its menu lookups legitimately take more rounds.
    const eventStream = agent.streamEvents(state, {
      version: 'v2',
      configurable: { thread_id: threadId },
      signal: ender.signal,
      ...(ctx.account ? {} : { recursionLimit: this.constantsService.private.LLM.AGENT_RECURSION_LIMIT }),
    });

    try {
      for await (const event of eventStream) {
        if (event.event === 'on_chat_model_stream' && event.data?.chunk) {
          const parsed = await this.outputParser.invoke(event.data.chunk);
          if (parsed) {
            spoke = true;
            yield parsed;
          }
        }
        if (event.event === 'on_chat_model_start' && repliedWithTools) {
          ender.abort();
        }
        if (event.event === 'on_chat_model_end' && event.data?.output) {
          const output = event.data.output;
          const text = typeof output.content === 'string' ? output.content.trim() : '';
          repliedWithTools = !ctx.account && text.length > 0 && (output.tool_calls?.length ?? 0) > 0;
          const maybeUsage = output.usage_metadata as { input_tokens?: number; output_tokens?: number; total_tokens?: number } | undefined;
          if (maybeUsage) {
            totalPromptTokens += maybeUsage.input_tokens ?? 0;
            totalCompletionTokens += maybeUsage.output_tokens ?? 0;
          }
        }
        if (event.event === 'on_chain_end' && event.data?.output) {
          lastResult = event.data.output as { messages?: BaseMessage[] };
        }
        if (event.event === 'on_tool_end') {
          const raw: any = event.data?.input?.input ?? event.data?.input;
          let input: Record<string, unknown> = {};
          try {
            input = typeof raw === 'string' ? JSON.parse(raw) : raw ?? {};
          } catch {
            // an input that is not JSON is recorded as empty rather than lost
          }
          const output: any = event.data?.output;
          finished.push({ toolName: event.name, toolCallId: event.run_id, input, output: output?.content ?? output });
        }
      }
    } catch (err: any) {
      // A reservation turn ended on purpose — by a tool, or by the step cap —
      // must not throw away the reply the caller has already heard. Anything
      // else still fails.
      if (ctx.account || !(ender.signal.aborted || err?.name === 'GraphRecursionError')) {
        throw err;
      }
      endedEarly = true;
    }

    // Never silent. Measured: after its tools ran, the model sometimes returned no
    // words at all, and the caller heard nothing. A reservation turn that ends
    // without a reply asks once more, without tools, for just the reply.
    if (!ctx.account && !spoke && lastResult?.messages?.length) {
      const nudge = new SystemMessage(this.constantsService.public.RESERVATION_REPLY_NUDGE);
      for await (const chunk of await this.createModel(0.7).stream([...lastResult.messages, nudge])) {
        const parsed = await this.outputParser.invoke(chunk);
        if (parsed) yield parsed;
      }
    }

    if (endedEarly || lastResult?.messages?.length) {
      const toolCalls = endedEarly ? finished : this.extractToolCalls(lastResult.messages);
      const usage: { promptTokens: number; completionTokens: number; totalTokens: number } = {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
      };
      yield { toolCalls, usage };
    }
  }
}
