import { Injectable, Logger } from '@nestjs/common';
import WebSocket from 'ws';
import { ChatContextService } from '../chat-context/chat-context.service';
import { AgentToolContext } from '../langgraph/langgraph-tools.context';
import { RealtimeToolsService, RealtimeToolDefinition } from '../langgraph/realtime-tools.service';
import { buildSystemInstructions, describeSpeakerRole } from './chat-prompt.builder';
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

  /**
   * Create a new Realtime WebSocket session for a given chat + booking
   * context. The returned session is identified by `sessionId`, which is
   * usually a per-socket identifier from the `/voice` gateway.
   */
  async createSession(sessionId: string, ctx: AgentToolContext, handlers: VoiceSessionHandlers): Promise<void> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for Realtime voice');
    }

    const model = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime';
    const baseUrl = process.env.OPENAI_REALTIME_URL || 'wss://api.openai.com/v1/realtime';
    const url = `${baseUrl}?model=${encodeURIComponent(model)}`;

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
    };

    this.sessions.set(sessionId, state);

    ws.on('open', async () => {
      state.isOpen = true;
      try {
        const appName = this.constantsService.public.APP_NAME;
        const hotel: any = ctx.hotel;
        const llmInstructions = hotel?.llmInstructions;
        const { instructions } = await buildSystemInstructions(this.chatContextService, ctx.chatId, appName, llmInstructions);
        const account: any = ctx.account;
        const speakerRoleDescription = describeSpeakerRole(account?.role);
        const instructionsWithSpeaker = `${instructions}\n\nFor this voice session, the authenticated speaker is ${speakerRoleDescription}. Address them appropriately for that role.`;
        const tools: RealtimeToolDefinition[] = this.realtimeToolsService.getToolsMetadata(ctx);

        const sessionUpdate = {
          type: 'session.update',
          session: {
            type: 'realtime',
            model,
            instructions: instructionsWithSpeaker,
            tools,
            tool_choice: 'auto',
            // Use audio-only; we derive text from output_audio_transcript events.
            output_modalities: ['audio'],
            audio: {
              input: {
                format: { type: 'audio/pcm', rate: 24000 },
                // Enable transcription so we get conversation.item.input_audio_transcription.*
                transcription: {
                  model: process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe',
                  // language and prompt are optional; defaults are fine for now.
                },
                noise_reduction: null,
                turn_detection: {
                  type: 'server_vad',
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 400,
                  idle_timeout_ms: 20000,
                  create_response: true,
                  interrupt_response: true,
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
   * Forward a client-originated event (e.g. input_audio_buffer.append or
   * input_audio_buffer.commit / response.create) to the Realtime model.
   */
  sendClientEvent(sessionId: string, event: unknown): void {
    const state = this.sessions.get(sessionId);
    if (!state) {
      throw new Error(`No Realtime session found for id: ${sessionId}`);
    }
    if (!state.isOpen || !state.sessionConfigured) {
      // Queue events until the underlying WebSocket is fully open and the
      // Realtime session has been configured (session.updated received).
      state.pendingEvents.push(event);
      return;
    }
    state.ws.send(JSON.stringify(event));
  }

  /**
   * Close and clean up a Realtime session.
   */
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

  /**
   * Consume (read and clear) the accumulated user/assistant transcripts and
   * tool call records for a session. Intended to be called by the gateway
   * when a model response has completed.
   */
  consumeTranscriptsAndTools(
    sessionId: string,
  ): { userTranscript?: string; assistantText?: string; toolCalls: ToolCallRecord[] } {
    const state = this.sessions.get(sessionId);
    if (!state) {
      return { toolCalls: [] };
    }
    const snapshot = {
      userTranscript: state.userTranscript,
      assistantText: state.assistantText,
      toolCalls: [...state.toolCalls],
    };
    state.userTranscript = undefined;
    state.assistantText = undefined;
    state.toolCalls = [];
    return snapshot;
  }

  private async handleServerEvent(sessionId: string, state: VoiceSessionState, event: any): Promise<void> {
    switch (event.type) {
      case 'session.updated': {
        // Session config (instructions/tools/audio) is now effective.
        state.sessionConfigured = true;
        // Flush any events that accumulated while waiting for session config.
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
        // Other events are forwarded to the gateway without extra handling.
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

    const output = typeof result === 'string' ? result : JSON.stringify(result);

    // Track tool call metadata for later persistence into Messages.
    const resultAny: any = result;
    const errorMsg = typeof result === 'object' && result !== null && 'error' in result ? String(resultAny.error) : undefined;
    state.toolCalls.push({
      toolName: name,
      toolCallId: callId,
      input: args,
      output: result,
      error: errorMsg,
    });

    // Inject a function_call_output item back into the conversation.
    const toolOutputEvent = {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output,
      },
    };

    state.ws.send(JSON.stringify(toolOutputEvent));

    // Trigger a new response so the model can incorporate the tool result.
    const responseCreateEvent = {
      type: 'response.create',
    };
    state.ws.send(JSON.stringify(responseCreateEvent));
  }
}

