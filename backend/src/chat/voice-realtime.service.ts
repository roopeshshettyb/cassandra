import { Injectable, Logger } from '@nestjs/common';
import WebSocket from 'ws';
import { ChatContextService } from '../chat-context/chat-context.service';
import { AgentToolContext } from '../langgraph/langgraph-tools.context';
import { RealtimeToolsService, RealtimeToolDefinition } from '../langgraph/realtime-tools.service';
import { buildSystemInstructions, buildReservationRealtimeInstructions } from './chat-prompt.builder';
import { ToolCallRecord } from '../langgraph/langgraph.service';
import { ConstantsService } from '../common/constants/constants.service';
import { TokenUsage } from '../costs/costs.pricing';

export interface VoiceSessionHandlers {
  onServerEvent?: (event: any) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

// Mirrors OpenAI Realtime's response.usage shape (response.done event).
interface RealtimeUsage {
  input_tokens?: number;
  output_tokens?: number;
  input_token_details?: { text_tokens?: number; audio_tokens?: number; cached_tokens?: number; cached_tokens_details?: { text_tokens?: number; audio_tokens?: number } };
  output_token_details?: { text_tokens?: number; audio_tokens?: number };
}

interface VoiceSessionState {
  ws: WebSocket;
  ctx: AgentToolContext;
  handlers: VoiceSessionHandlers;
  userTranscript?: string;
  assistantText?: string;
  toolCalls: ToolCallRecord[];
  isOpen: boolean;
  pendingEvents: unknown[];
  sessionConfigured: boolean;
  transcriptionModel: string;
  isResponding: boolean;
  pendingToolResponse: boolean;
  /** Tool executions from the response in flight, awaited before its follow-up is requested. */
  pendingToolCalls: Promise<void>[];
  /** Rate-limited responses re-requested since the caller last spoke. */
  rateLimitRetries: number;
  // Real usage from the most recent response.done, consumed alongside the
  // transcripts. Absent only if OpenAI ever omits it (e.g. an error/cancelled
  // response) — countTokens() below is the fallback for that case only.
  lastUsage?: RealtimeUsage;
}

@Injectable()
export class VoiceRealtimeService {
  private readonly logger = new Logger(VoiceRealtimeService.name);
  private readonly sessions = new Map<string, VoiceSessionState>();

  constructor(
    private readonly chatContextService: ChatContextService,
    private readonly realtimeToolsService: RealtimeToolsService,
    private readonly constantsService: ConstantsService,
  ) {}

  async createSession(sessionId: string, ctx: AgentToolContext, handlers: VoiceSessionHandlers): Promise<void> {
    const sttConfig = this.constantsService.private.LLM.STT_CONFIG;
    const openaiConfig = sttConfig.OPENAI;
    const apiKey = openaiConfig.API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for Realtime voice');
    }

    const model = openaiConfig.REALTIME_MODEL;
    const baseUrl = openaiConfig.REALTIME_URL;
    const url = `${baseUrl}?model=${encodeURIComponent(model)}`;

    const transcriptionModel = openaiConfig.TRANSCRIBE_MODEL;

    const ws = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const state: VoiceSessionState = {
      ws,
      ctx,
      handlers,
      toolCalls: [],
      isOpen: false,
      pendingEvents: [],
      sessionConfigured: false,
      transcriptionModel,
      isResponding: false,
      pendingToolResponse: false,
      pendingToolCalls: [],
      rateLimitRetries: 0,
    };

    this.sessions.set(sessionId, state);

    ws.on('open', async () => {
      state.isOpen = true;
      try {
        const languageCode = ctx.languageCode ?? null;
        const instructionsWithSpeaker = await this.instructionsFor(ctx, languageCode);
        const tools: RealtimeToolDefinition[] = this.realtimeToolsService.getToolsMetadata(ctx);

        const sessionUpdate = {
          type: 'session.update',
          session: {
            type: 'realtime',
            model,
            instructions: instructionsWithSpeaker,
            tools,
            tool_choice: 'auto',
            output_modalities: ['audio'],
            audio: {
              input: {
                format: { type: 'audio/pcm', rate: 24000 },
                transcription: {
                  model: transcriptionModel,
                  ...(languageCode ? { language: languageCode } : {}),
                },
                noise_reduction: null,
                turn_detection: {
                  type: 'server_vad',
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 400,
                  idle_timeout_ms: 20000,
                  create_response: false,
                  interrupt_response: false,
                },
              },
              output: {
                format: { type: 'audio/pcm', rate: 24000 },
                voice: 'marin',
                speed: 1,
              },
            },
          },
        };

        ws.send(JSON.stringify(sessionUpdate));
      } catch (err: any) {
        this.logger.error('Failed to send session.update to Realtime API', err);
        handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
      }

      handlers.onServerEvent?.({
        type: 'session.client_opened',
        sessionId,
      });
    });

    ws.on('message', async (data: WebSocket.RawData) => {
      let event: any;
      try {
        event = JSON.parse(data.toString());
      } catch (err) {
        this.logger.warn('Failed to parse Realtime server event', err as Error);
        return;
      }

      try {
        await this.handleServerEvent(sessionId, state, event);
      } catch (err) {
        this.logger.error('Error while handling Realtime server event', err as Error);
      }

      state.handlers.onServerEvent?.(event);
    });

    ws.on('error', (err) => {
      this.logger.error('Realtime WebSocket error', err as Error);
      handlers.onError?.(err as Error);
    });

    ws.on('close', () => {
      this.sessions.delete(sessionId);
      handlers.onClose?.();
    });
  }

  /**
   * Instructions for this session — the concierge's for a signed-in guest, the
   * reservation agent's for a public caller with no account. Used both at the
   * start of a session and when the language changes mid-call, so a public call
   * can never be handed the concierge's prompt halfway through. The concierge
   * branch is the call that was here before, unchanged.
   */
  private async instructionsFor(ctx: AgentToolContext, languageCode: string | null): Promise<string> {
    const appName = this.constantsService.public.APP_NAME;
    const hotel: any = ctx.hotel;
    const account: any = ctx.account;
    if (!account) {
      return buildReservationRealtimeInstructions(this.chatContextService, ctx.chatId, appName, ctx.hotel, languageCode);
    }
    const { instructionsWithoutRole } = await buildSystemInstructions(this.chatContextService, ctx.chatId, appName, hotel?.llmInstructions, account?.role, languageCode, true);
    return instructionsWithoutRole;
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  getContext(sessionId: string): AgentToolContext | null {
    const state = this.sessions.get(sessionId);
    if (!state) {
      return null;
    }
    return state.ctx;
  }

  setUserTranscript(sessionId: string, text: string): void {
    const state = this.sessions.get(sessionId);
    if (!state) return;
    state.userTranscript = text;
  }

  sendClientEvent(sessionId: string, event: unknown): void {
    const state = this.sessions.get(sessionId);
    if (!state) {
      throw new Error(`No Realtime session found for id: ${sessionId}`);
    }
    if (state.isResponding && (event as any)?.type === 'input_audio_buffer.append') {
      return;
    }
    if (!state.isOpen || !state.sessionConfigured) {
      state.pendingEvents.push(event);
      return;
    }
    state.ws.send(JSON.stringify(event));
  }

  onPlaybackDone(sessionId: string): void {
    const state = this.sessions.get(sessionId);
    if (!state) return;
    state.isResponding = false;
    try {
      state.ws.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
    } catch {
      // ignore — session may have closed
    }
  }

  closeSession(sessionId: string): void {
    const state = this.sessions.get(sessionId);
    if (!state) return;
    this.sessions.delete(sessionId);
    try {
      state.ws.close();
    } catch {
      // ignore
    }
  }

  consumeTranscriptsAndTools(sessionId: string): {
    userTranscript?: string;
    assistantText?: string;
    toolCalls: ToolCallRecord[];
    usage?: TokenUsage;
  } {
    const state = this.sessions.get(sessionId);
    if (!state) {
      return { toolCalls: [] };
    }
    const snapshotUser = state.userTranscript;
    const snapshotAssistant = state.assistantText;
    const usage = this.buildTokenUsage(state.lastUsage, snapshotUser, snapshotAssistant);

    const snapshot = {
      userTranscript: snapshotUser,
      assistantText: snapshotAssistant,
      toolCalls: [...state.toolCalls],
      usage,
    };
    state.userTranscript = undefined;
    state.assistantText = undefined;
    state.toolCalls = [];
    state.lastUsage = undefined;
    return snapshot;
  }

  // Real usage should be present on every completed response.done — countTokens()
  // below only covers the case where OpenAI omits it entirely (e.g. a cancelled
  // response), and is flagged `estimated` so it's never silently mistaken for real spend.
  private buildTokenUsage(realUsage: RealtimeUsage | undefined, userTranscript?: string, assistantText?: string): TokenUsage {
    if (!realUsage) {
      this.logger.warn('Realtime response.done had no usage object — falling back to word-count estimate');
      const promptTokens = this.countTokens(userTranscript);
      const completionTokens = this.countTokens(assistantText);
      return { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens, estimated: true };
    }
    const input = realUsage.input_token_details;
    const output = realUsage.output_token_details;
    return {
      promptTokens: input?.text_tokens ?? 0,
      completionTokens: output?.text_tokens ?? 0,
      totalTokens: (realUsage.input_tokens ?? 0) + (realUsage.output_tokens ?? 0),
      audioPromptTokens: input?.audio_tokens ?? 0,
      audioCompletionTokens: output?.audio_tokens ?? 0,
      cachedTextPromptTokens: input?.cached_tokens_details?.text_tokens ?? 0,
      cachedAudioPromptTokens: input?.cached_tokens_details?.audio_tokens ?? 0,
    };
  }

  // Sums a new response's usage into the turn-level running total, field by field.
  private accumulateUsage(state: VoiceSessionState, newUsage: RealtimeUsage | undefined): void {
    if (!newUsage) return;
    const prev = state.lastUsage;
    state.lastUsage = {
      input_tokens: (prev?.input_tokens ?? 0) + (newUsage.input_tokens ?? 0),
      output_tokens: (prev?.output_tokens ?? 0) + (newUsage.output_tokens ?? 0),
      input_token_details: {
        text_tokens: (prev?.input_token_details?.text_tokens ?? 0) + (newUsage.input_token_details?.text_tokens ?? 0),
        audio_tokens: (prev?.input_token_details?.audio_tokens ?? 0) + (newUsage.input_token_details?.audio_tokens ?? 0),
        cached_tokens_details: {
          text_tokens: (prev?.input_token_details?.cached_tokens_details?.text_tokens ?? 0) + (newUsage.input_token_details?.cached_tokens_details?.text_tokens ?? 0),
          audio_tokens: (prev?.input_token_details?.cached_tokens_details?.audio_tokens ?? 0) + (newUsage.input_token_details?.cached_tokens_details?.audio_tokens ?? 0),
        },
      },
      output_token_details: {
        text_tokens: (prev?.output_token_details?.text_tokens ?? 0) + (newUsage.output_token_details?.text_tokens ?? 0),
        audio_tokens: (prev?.output_token_details?.audio_tokens ?? 0) + (newUsage.output_token_details?.audio_tokens ?? 0),
      },
    };
  }

  private countTokens(text?: string): number {
    if (!text) {
      return 0;
    }
    const trimmed = text.trim();
    if (!trimmed) {
      return 0;
    }
    const parts = trimmed.split(/\s+/);
    return parts.length;
  }

  private async handleServerEvent(sessionId: string, state: VoiceSessionState, event: any): Promise<void> {
    switch (event.type) {
      case 'session.updated': {
        state.sessionConfigured = true;
        for (const queued of state.pendingEvents) {
          try {
            state.ws.send(JSON.stringify(queued));
          } catch (err) {
            this.logger.warn('Failed to send queued Realtime event after session.updated', err as Error);
          }
        }
        state.pendingEvents = [];
        break;
      }
      case 'response.created': {
        state.isResponding = true;
        try {
          state.ws.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
        } catch {
          // ignore
        }
        break;
      }
      case 'response.done': {
        // A single user turn can produce multiple response.done events (a
        // tool-call round, then the final audio/text response) before
        // consumeTranscriptsAndTools is next called — accumulate rather than
        // overwrite, so the tool-call round's real tokens aren't dropped.
        this.accumulateUsage(state, event.response?.usage);
        const openai = this.constantsService.private.LLM.STT_CONFIG.OPENAI;
        const failure = event.response?.status_details?.error;
        if (failure?.code === openai.RATE_LIMIT_CODE && state.rateLimitRetries < openai.RATE_LIMIT_RETRIES) {
          // Refused for the per-minute token limit, not for anything the model
          // did: ask again once the window allows, rather than leaving the
          // caller in silence. Not the end of the turn, so nothing is relayed.
          state.rateLimitRetries += 1;
          event._skipVoiceTextEnd = true;
          const waitMs = Math.min(parseFloat(/in ([\d.]+)s/.exec(failure.message || '')?.[1] || '1') * 1000, openai.RATE_LIMIT_MAX_WAIT_MS);
          setTimeout(() => {
            try {
              state.ws.send(JSON.stringify({ type: 'response.create' }));
            } catch {
              // ignore — session may have closed
            }
          }, waitMs);
          break;
        }
        const output: any[] = Array.isArray(event.response?.output) ? event.response.output : [];
        const hadToolCalls = state.pendingToolResponse || output.some((item) => item?.type === 'function_call');
        if (hadToolCalls) {
          state.pendingToolResponse = false;
          event._skipVoiceTextEnd = true;
          // One follow-up per tool round, not one per call. Asking again for each
          // call meant a second response.create while the first was still
          // running, which the API rejects — and with several calls in one
          // response that left the turn half-answered. So every output goes in
          // first, then the follow-up is requested once.
          const pending = state.pendingToolCalls;
          state.pendingToolCalls = [];
          await Promise.allSettled(pending);
          try {
            state.ws.send(JSON.stringify({ type: 'response.create' }));
          } catch {
            // ignore — session may have closed
          }
        } else {
          try {
            state.ws.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
          } catch {
            // ignore
          }
        }
        break;
      }
      case 'input_audio_buffer.committed': {
        state.rateLimitRetries = 0;
        if (state.isResponding) {
          const itemId = event.item_id ?? null;
          if (itemId) {
            try {
              state.ws.send(JSON.stringify({ type: 'conversation.item.delete', item_id: itemId }));
            } catch {
              // ignore
            }
          }
        } else {
          try {
            state.ws.send(JSON.stringify({ type: 'response.create' }));
          } catch {
            // ignore
          }
        }
        break;
      }
      case 'response.output_text.delta':
        state.assistantText = (state.assistantText || '') + (event.delta || '');
        break;
      case 'response.output_text.done':
        state.assistantText = event.text ?? state.assistantText;
        break;
      case 'response.output_audio_transcript.delta':
        state.assistantText = (state.assistantText || '') + (event.delta || '');
        break;
      case 'response.output_audio_transcript.done':
        state.assistantText = event.transcript ?? state.assistantText;
        break;
      case 'conversation.item.input_audio_transcription.delta':
        state.userTranscript = (state.userTranscript || '') + (event.delta || '');
        break;
      case 'conversation.item.input_audio_transcription.completed':
        state.userTranscript = event.transcript ?? state.userTranscript;
        break;
      case 'response.function_call_arguments.done': {
        // Registered before awaiting, so a response.done processed alongside it
        // still knows to wait for this call.
        const call = this.handleFunctionCall(state, event);
        state.pendingToolCalls.push(call);
        await call;
        break;
      }
      case 'error':
        this.logger.warn(`Realtime error for session ${sessionId}`, event?.error ?? event);
        break;
      default:
        break;
    }
  }

  private async handleFunctionCall(state: VoiceSessionState, event: any): Promise<void> {
    const name: string | undefined = event.name;
    const callId: string | undefined = event.call_id;
    const argsJson: string | undefined = event.arguments;

    if (!name || !callId) {
      this.logger.warn('Function call event missing name or call_id', event);
      return;
    }

    state.pendingToolResponse = true;

    let args: Record<string, unknown> = {};
    if (argsJson) {
      try {
        args = JSON.parse(argsJson);
      } catch (err) {
        this.logger.warn('Failed to parse function call arguments JSON', err as Error);
      }
    }

    let result: unknown;
    try {
      result = await this.realtimeToolsService.executeTool(state.ctx, name, args);
    } catch (err) {
      this.logger.error(`Tool execution failed for ${name}`, err as Error);
      result = {
        error: (err as Error)?.message ?? String(err),
      };
    }

    if (name === 'set_chat_language') {
      const argsAny: any = args;
      const newLanguageCodeRaw: unknown = argsAny?.languageCode;
      const newLanguageCode = typeof newLanguageCodeRaw === 'string' ? newLanguageCodeRaw : null;
      if (newLanguageCode) {
        try {
          state.ctx.languageCode = newLanguageCode;
          const updatedInstructions = await this.instructionsFor(state.ctx, newLanguageCode);

          const sessionUpdateEvent = {
            type: 'session.update',
            session: {
              type: 'realtime',
              instructions: updatedInstructions,
              audio: {
                input: {
                  transcription: {
                    model: state.transcriptionModel,
                    language: newLanguageCode,
                  },
                },
              },
            },
          };
          state.ws.send(JSON.stringify(sessionUpdateEvent));
        } catch (err) {
          this.logger.error('Failed to apply language change from set_chat_language tool', err as Error);
        }
      }
    }

    const output = typeof result === 'string' ? result : JSON.stringify(result);

    const resultAny: any = result;
    const errorMsg = typeof result === 'object' && result !== null && 'error' in result ? String(resultAny.error) : undefined;
    state.toolCalls.push({
      toolName: name,
      toolCallId: callId,
      input: args,
      output: result,
      error: errorMsg,
    });

    const toolOutputEvent = {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output,
      },
    };

    state.ws.send(JSON.stringify(toolOutputEvent));
  }
}
