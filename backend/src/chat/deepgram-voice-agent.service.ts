import { Injectable, Logger } from '@nestjs/common';
import WebSocket from 'ws';
import { ChatContextService } from '../chat-context/chat-context.service';
import { AgentToolContext } from '../langgraph/langgraph-tools.context';
import { RealtimeToolsService } from '../langgraph/realtime-tools.service';
import { buildSystemInstructions } from './chat-prompt.builder';
import { ToolCallRecord } from '../langgraph/langgraph.service';
import { ConstantsService } from '../common/constants/constants.service';
import { VoiceSessionHandlers } from './voice-realtime.service';

interface DeepgramVoiceSessionState {
  ws: WebSocket;
  ctx: AgentToolContext;
  handlers: VoiceSessionHandlers;
  userTranscript?: string;
  assistantText?: string;
  toolCalls: ToolCallRecord[];
  isOpen: boolean;
  pendingAudio: Buffer[];
  sessionConfigured: boolean;
  thinkConfig: any;
}

@Injectable()
export class DeepgramVoiceAgentService {
  private readonly logger = new Logger(DeepgramVoiceAgentService.name);
  private readonly sessions = new Map<string, DeepgramVoiceSessionState>();

  constructor(
    private readonly chatContextService: ChatContextService,
    private readonly realtimeToolsService: RealtimeToolsService,
    private readonly constantsService: ConstantsService,
  ) {}

  async createSession(sessionId: string, ctx: AgentToolContext, handlers: VoiceSessionHandlers): Promise<void> {
    const config = this.constantsService.private.LLM.DEEPGRAM_VOICE_AGENT;
    if (!config.API_KEY) {
      throw new Error('DEEPGRAM_API_KEY is required for Deepgram Voice Agent');
    }

    const ws = new WebSocket(config.URL, {
      headers: { Authorization: `Token ${config.API_KEY}` },
    });

    const state: DeepgramVoiceSessionState = {
      ws,
      ctx,
      handlers,
      toolCalls: [],
      isOpen: false,
      pendingAudio: [],
      sessionConfigured: false,
      thinkConfig: null,
    };

    this.sessions.set(sessionId, state);

    ws.on('open', async () => {
      state.isOpen = true;
      try {
        const { instructionsWithoutRole: systemPrompt } = await buildSystemInstructions(
          this.chatContextService,
          ctx.chatId,
          this.constantsService.public.APP_NAME,
          (ctx.hotel as any)?.llmInstructions,
          (ctx.account as any)?.role,
          ctx.languageCode ?? null,
          true,
        );

        const tools = this.realtimeToolsService.getToolsMetadata(ctx);
        const functions = tools.map(({ name, description, parameters }) => ({ name, description, parameters }));

        const thinkConfig: any = {
          provider: { type: config.THINK_PROVIDER, model: config.THINK_MODEL },
          prompt: systemPrompt,
          functions,
          ...(config.THINK_OPENAI_API_KEY && config.THINK_PROVIDER === 'open_ai'
            ? {
                endpoint: {
                  url: 'https://api.openai.com/v1/chat/completions',
                  headers: { authorization: `Bearer ${config.THINK_OPENAI_API_KEY}` },
                },
              }
            : {}),
        };
        state.thinkConfig = thinkConfig;

        ws.send(
          JSON.stringify({
            type: 'Settings',
            audio: {
              input: { encoding: 'linear16', sample_rate: 24000 },
              output: { encoding: 'linear16', sample_rate: 24000, container: 'none' },
            },
            agent: {
              listen: { provider: { type: 'deepgram', model: config.LISTEN_MODEL } },
              think: thinkConfig,
              speak: { provider: { type: 'deepgram', model: config.SPEAK_MODEL } },
            },
          }),
        );
      } catch (err: any) {
        this.logger.error('Failed to send Settings to Deepgram Voice Agent', err);
        handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
      }

      handlers.onServerEvent?.({ type: 'session.client_opened', sessionId });
    });

    ws.on('message', async (data: WebSocket.RawData, isBinary: boolean) => {
      if (isBinary) {
        handlers.onServerEvent?.({ type: 'audio_chunk', audio: data as Buffer });
        return;
      }

      let event: any;
      try {
        event = JSON.parse(data.toString());
      } catch (err) {
        this.logger.warn('Failed to parse Deepgram Voice Agent event', err as Error);
        return;
      }

      try {
        await this.handleServerEvent(sessionId, state, event);
      } catch (err) {
        this.logger.error('Error handling Deepgram Voice Agent event', err as Error);
      }

      state.handlers.onServerEvent?.(event);
    });

    ws.on('error', (err) => {
      this.logger.error('Deepgram Voice Agent WebSocket error', err);
      handlers.onError?.(err);
    });

    ws.on('close', () => {
      this.sessions.delete(sessionId);
      handlers.onClose?.();
    });
  }

  sendAudio(sessionId: string, buffer: Buffer): void {
    const state = this.sessions.get(sessionId);
    if (!state) return;
    if (!state.isOpen || !state.sessionConfigured) {
      state.pendingAudio.push(buffer);
      return;
    }
    state.ws.send(buffer);
  }

  getContext(sessionId: string): AgentToolContext | null {
    const state = this.sessions.get(sessionId);
    if (!state) {
      return null;
    }
    return state.ctx;
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
  } {
    const state = this.sessions.get(sessionId);
    if (!state) return { toolCalls: [] };
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

  private async handleServerEvent(sessionId: string, state: DeepgramVoiceSessionState, event: any): Promise<void> {
    switch (event.type) {
      case 'SettingsApplied': {
        state.sessionConfigured = true;
        for (const buf of state.pendingAudio) {
          try {
            state.ws.send(buf);
          } catch (err) {
            this.logger.warn('Failed to send queued audio after SettingsApplied', err as Error);
          }
        }
        state.pendingAudio = [];
        break;
      }
      case 'ConversationText': {
        const role: string = event.role;
        const content: string = event.content;
        if (role === 'user') {
          state.userTranscript = content;
        } else if (role === 'assistant') {
          state.assistantText = content;
        }
        break;
      }
      case 'FunctionCallRequest': {
        const functions: any[] = event.functions ?? [];
        for (const fn of functions) {
          await this.handleFunctionCall(state, fn);
        }
        break;
      }
      case 'Error':
      case 'error':
        this.logger.warn(`Deepgram Voice Agent error for session ${sessionId}`, event);
        break;
      default:
        break;
    }
  }

  private async handleFunctionCall(state: DeepgramVoiceSessionState, fn: any): Promise<void> {
    const name: string = fn.name;
    const callId: string = fn.id;
    let args: Record<string, unknown> = {};
    try {
      args = fn.arguments ? JSON.parse(fn.arguments) : {};
    } catch {
      this.logger.warn('Failed to parse function call arguments', fn);
    }

    let result: unknown;
    try {
      result = await this.realtimeToolsService.executeTool(state.ctx, name, args);
    } catch (err) {
      this.logger.error(`Tool execution failed for ${name}`, err as Error);
      result = { error: (err as Error)?.message ?? String(err) };
    }

    if (name === 'set_chat_language') {
      const newLanguageCode = typeof (args as any)?.languageCode === 'string' ? (args as any).languageCode : null;
      if (newLanguageCode && state.thinkConfig) {
        try {
          state.ctx.languageCode = newLanguageCode;
          const { instructionsWithoutRole: updatedPrompt } = await buildSystemInstructions(
            this.chatContextService,
            state.ctx.chatId,
            this.constantsService.public.APP_NAME,
            (state.ctx.hotel as any)?.llmInstructions,
            (state.ctx.account as any)?.role,
            newLanguageCode,
            true,
          );
          const updatedThink = { ...state.thinkConfig, prompt: updatedPrompt };
          state.thinkConfig = updatedThink;
          state.ws.send(JSON.stringify({ type: 'UpdateThink', think: updatedThink }));
        } catch (err) {
          this.logger.error('Failed to apply language change', err as Error);
        }
      }
    }

    const output = typeof result === 'string' ? result : JSON.stringify(result);
    const errorMsg =
      typeof result === 'object' && result !== null && 'error' in result ? String((result as any).error) : undefined;

    state.toolCalls.push({ toolName: name, toolCallId: callId, input: args, output: result, error: errorMsg });

    state.ws.send(JSON.stringify({ type: 'FunctionCallResponse', id: callId, name, content: output }));
  }
}
