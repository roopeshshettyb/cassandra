import { Injectable, Logger } from '@nestjs/common';
import WebSocket from 'ws';
import { ChatContextService } from '../chat-context/chat-context.service';
import { AgentToolContext } from '../langgraph/langgraph-tools.context';
import { RealtimeToolsService, RealtimeToolDefinition } from '../langgraph/realtime-tools.service';
import { buildSystemInstructions } from './chat-prompt.builder';
import { ToolCallRecord } from '../langgraph/langgraph.service';
import { ConstantsService } from '../common/constants/constants.service';

export interface VoiceSessionHandlers {
  onServerEvent?: (event: any) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
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
    const realtimeVoice = openaiConfig.REALTIME_VOICE;
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
    };

    this.sessions.set(sessionId, state);

    ws.on('open', async () => {
      state.isOpen = true;
      try {
        const appName = this.constantsService.public.APP_NAME;
        const hotel: any = ctx.hotel;
        const llmInstructions = hotel?.llmInstructions;
        const account: any = ctx.account;
        const languageCode = ctx.languageCode ?? null;
        const { instructionsWithoutRole: instructionsWithSpeaker } = await buildSystemInstructions(this.chatContextService, ctx.chatId, appName, llmInstructions, account?.role, languageCode);
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
                voice: realtimeVoice,
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

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
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
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  } {
    const state = this.sessions.get(sessionId);
    if (!state) {
      return { toolCalls: [] };
    }
    const snapshotUser = state.userTranscript;
    const snapshotAssistant = state.assistantText;
    const promptTokens = this.countTokens(snapshotUser);
    const completionTokens = this.countTokens(snapshotAssistant);
    const totalTokens = promptTokens + completionTokens;

    const snapshot = {
      userTranscript: snapshotUser,
      assistantText: snapshotAssistant,
      toolCalls: [...state.toolCalls],
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
      },
    };
    state.userTranscript = undefined;
    state.assistantText = undefined;
    state.toolCalls = [];
    return snapshot;
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
        if (state.pendingToolResponse) {
          state.pendingToolResponse = false;
          event._skipVoiceTextEnd = true;
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
      case 'response.function_call_arguments.done':
        await this.handleFunctionCall(state, event);
        break;
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
          const appName = this.constantsService.public.APP_NAME;
          const hotel: any = state.ctx.hotel;
          const llmInstructions = hotel?.llmInstructions;
          const account: any = state.ctx.account;
          const { instructionsWithoutRole: updatedInstructions } = await buildSystemInstructions(this.chatContextService, state.ctx.chatId, appName, llmInstructions, account?.role, newLanguageCode);

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
    state.ws.send(JSON.stringify({ type: 'response.create' }));
  }
}
