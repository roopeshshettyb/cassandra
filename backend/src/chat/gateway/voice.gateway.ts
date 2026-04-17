import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../../auth/auth.service';
import { ChatService } from '../chat.service';
import { ChatSession } from './chat-session.interface';
import { BookingsService } from '../../bookings/bookings.service';
import { ConstantsService } from '../../common/constants/constants.service';
import { LoggerService } from '../../common/logger.service';
import { SttFactoryService } from '../../stt/stt-factory.service';
import type { ISttSession } from '../../stt/stt-session.interface';
import { TtsFactoryService } from '../../tts/tts-factory.service';
import { ChatLlmService } from '../chat-llm.service';
import { VoiceRealtimeService } from '../voice-realtime.service';
import { DeepgramVoiceAgentService } from '../deepgram-voice-agent.service';
import { MessagesService } from '../../messages/messages.service';
import { Message, MessageRole } from '../../messages/message.model';
import { ChatContextService } from '../../chat-context/chat-context.service';
import { CostsService } from '../../costs/costs.service';
import { CostType } from '../../costs/costs.model';
import { parseConnectionHandshake, authenticateBookingAndInit } from './gateway-auth.helper';

export interface VoiceTurnStatistics {
  lastAudioAt: number;
  responseStart: number;
  sttMs: number;
  llmStart: number;
  llmMs: number;
  ttsMs: number;
  totalProcessingMs: number;
}

@WebSocketGateway({ cors: true, namespace: '/voice' })
@Injectable()
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VoiceGateway.name);

  constructor(
    private readonly authService: AuthService,
    private readonly chatService: ChatService,
    private readonly bookingsService: BookingsService,
    private readonly constantsService: ConstantsService,
    private readonly loggerService: LoggerService,
    private readonly sttFactory: SttFactoryService,
    private readonly ttsFactory: TtsFactoryService,
    private readonly chatLlmService: ChatLlmService,
    private readonly voiceRealtimeService: VoiceRealtimeService,
    private readonly deepgramVoiceAgentService: DeepgramVoiceAgentService,
    private readonly messagesService: MessagesService,
    private readonly chatContextService: ChatContextService,
    private readonly costsService: CostsService,
  ) {}

  private isGptVoicePipeline(): boolean {
    return this.constantsService.private.LLM.VOICE_PIPELINE === 'gpt';
  }

  private isDeepgramVoicePipeline(): boolean {
    return this.constantsService.private.LLM.VOICE_PIPELINE === 'deepgram';
  }

  async handleConnection(client: any) {
    const { token, bookingId } = parseConnectionHandshake(client);
    if (token && bookingId !== undefined) {
      await authenticateBookingAndInit(
        client,
        token,
        bookingId,
        {
          authService: this.authService,
          chatService: this.chatService,
          bookingsService: this.bookingsService,
          constantsService: this.constantsService,
        },
        async () => {
          client.emit('voice_ready');
        },
      );
    } else {
      client.sessionPending = { token: null, bookingId: null };
      client.emit('auth_required', { message: 'Send auth with token and bookingId' });
    }
  }

  @SubscribeMessage('auth')
  async onAuth(client: any, payload: { token: string; bookingId: number }) {
    if (client.session) {
      client.emit('error', { message: 'Already authenticated' });
      return;
    }
    const token = payload?.token;
    const bookingId = payload?.bookingId;
    if (!token || !bookingId) {
      client.emit('error', { message: 'auth requires token and bookingId' });
      return;
    }
    await authenticateBookingAndInit(
      client,
      token,
      bookingId,
      {
        authService: this.authService,
        chatService: this.chatService,
        bookingsService: this.bookingsService,
        constantsService: this.constantsService,
      },
      async () => {
        client.emit('voice_ready');
      },
    );
  }

  /**
   * Splits buffer on sentence-ending punctuation (.!?) and streams each complete sentence to TTS.
   * Mutates state.sentenceBuffer, state.fullText, state.ttsQueue, state.statistics.ttsMs.
   */
  private flushCompletedSentencesToTts(
    state: { sentenceBuffer: string; fullText: string; ttsQueue: Promise<void>; statistics: VoiceTurnStatistics; languageCode: string | null },
    client: any,
    provider: { streamToClient: (client: any, text: string, options?: { emitEnd?: boolean; languageCode?: string | null }) => Promise<void> },
  ): void {
    const regex = /([.!?])\s+/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    const parts: string[] = [];
    while ((match = regex.exec(state.sentenceBuffer)) !== null) {
      const endIndex = match.index + 1;
      const sentence = state.sentenceBuffer.slice(lastIndex, endIndex).trim();
      if (sentence.length > 0) parts.push(sentence);
      lastIndex = regex.lastIndex;
    }
    if (parts.length === 0) return;

    state.sentenceBuffer = state.sentenceBuffer.slice(lastIndex);
    for (const sentence of parts) {
      state.fullText += sentence;
      state.ttsQueue = state.ttsQueue.then(async () => {
        const t0 = Date.now();
        await provider.streamToClient(client, sentence, { emitEnd: false, languageCode: state.languageCode });
        state.statistics.ttsMs += Date.now() - t0;
      });
      client.emit('voice_text_chunk', { delta: sentence });
    }
  }

  private createSttSession(client: any): ISttSession | null {
    if (client.sttSession) {
      client.sttSession.destroy();
      client.sttSession = null;
    }
    if (client.voiceBusy) {
      return null;
    }
    try {
      const factory = this.sttFactory.getFactory();
      const sttSession: ISttSession = factory.createSession();
      client.sttSession = sttSession;
      client._voiceStatistics = {
        lastAudioAt: Date.now(),
        responseStart: 0,
        sttMs: 0,
        llmStart: 0,
        llmMs: 0,
        ttsMs: 0,
        totalProcessingMs: 0,
      } as VoiceTurnStatistics;
      let lastFinalTranscript = '';

      sttSession.onTranscript((text: string, isFinal?: boolean) => {
        if (isFinal) lastFinalTranscript = text;
        client.emit('voice_user_chunk', { delta: text, isFinal: !!isFinal });
      });

      sttSession.onEndOfSpeech(() => {
        sttSession.endInput();
        if (client.sttSession === sttSession) {
          client.sttSession = null;
        }
        sttSession.destroy();
        client.emit('voice_turn_end');

        const statistics = client._voiceStatistics as VoiceTurnStatistics;
        statistics.responseStart = Date.now();
        statistics.sttMs = statistics.responseStart - (statistics.lastAudioAt ?? statistics.responseStart);
        statistics.llmStart = Date.now();
        statistics.llmMs = 0;
        statistics.ttsMs = 0;
        statistics.totalProcessingMs = 0;

        const textToSpeak = lastFinalTranscript;
        const session: ChatSession | undefined = client.session;

        if (!session) {
          client.emit('error', { message: 'Not authenticated' });
          client.emit('voice_ready');
          return;
        }

        if (!textToSpeak || typeof textToSpeak !== 'string') {
          client.emit('voice_ready');
          return;
        }

        client.emit('voice_user_message', { text: textToSpeak });

        client.voiceBusy = true;
        const provider = this.ttsFactory.getProvider();

        const state = {
          sentenceBuffer: '',
          fullText: '',
          ttsQueue: Promise.resolve() as Promise<void>,
          statistics,
          languageCode: session.languageCode ?? null,
        };

        this.chatLlmService
          .streamUserMessage(session, textToSpeak, {
            mode: 'voice',
            onChunk: (chunk: string) => {
              if (!chunk) return;
              state.sentenceBuffer += chunk;
              this.flushCompletedSentencesToTts(state, client, provider);
            },
            onEnd: async (result) => {
              state.statistics.llmMs = Date.now() - state.statistics.llmStart;
              if (state.sentenceBuffer.trim().length > 0) {
                state.fullText += state.sentenceBuffer.trim();
                await state.ttsQueue;
                const t0 = Date.now();
                await provider.streamToClient(client, state.sentenceBuffer.trim(), { emitEnd: true, languageCode: state.languageCode });
                state.statistics.ttsMs += Date.now() - t0;
              } else {
                await state.ttsQueue;
                // All sentences were flushed with emitEnd:false — emit audio_end now so the
                // client's source.onended counter can resolve and voice_playback_done is sent.
                client.emit('voice_audio_end');
              }
              state.statistics.totalProcessingMs = Date.now() - state.statistics.responseStart;
              this.loggerService.log({
                message: 'Voice cycle complete',
                serviceName: 'VoiceGateway',
                actionName: 'createSttSession',
                traces: [
                  { sttMs: state.statistics.sttMs },
                  { llmMs: state.statistics.llmMs },
                  { ttsMs: state.statistics.ttsMs },
                  { totalProcessingMs: state.statistics.totalProcessingMs },
                ],
              });
              client.emit('voice_text_end', { text: result.fullContent || state.fullText });
            },
          })
          .catch((err: any) => {
            this.loggerService.warn({
              message: err?.message ?? String(err),
              traces: [{ error: 'LLM+TTS' }],
            });
            client.emit('error', { message: 'Voice response failed' });
            client.emit('voice_ready');
            client.voiceBusy = false;
          });
      });

      return sttSession;
    } catch (err: any) {
      this.loggerService.error({
        error: err,
        traces: [{ stage: 'STT session' }],
      });
      client.emit('error', { message: err?.message || 'STT session failed' });
      return null;
    }
  }

  @SubscribeMessage('voice_start')
  async onVoiceStart(client: any) {
    const session: ChatSession | undefined = client.session;
    if (!session) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    const toolContext = {
      account: session.account,
      bookingId: session.bookingId,
      chatId: session.chatId,
      hotel: session.hotel,
      booking: session.booking,
      languageCode: session.languageCode ?? null,
    };
    if (this.isGptVoicePipeline()) {
      try {
        await this.voiceRealtimeService.createSession(client.id, toolContext, {
          onServerEvent: (event) => this.handleRealtimeEvent(client, event),
          onError: (error) => {
            this.logger.error(error);
            client.emit('error', { message: error.message || 'Voice session error' });
          },
          onClose: () => {
            client.emit('voice_closed');
          },
        });
        client.emit('voice_ready');
      } catch (err: any) {
        this.logger.error(err);
        client.emit('error', { message: err?.message || 'Failed to start voice session' });
      }
    } else if (this.isDeepgramVoicePipeline()) {
      try {
        await this.deepgramVoiceAgentService.createSession(client.id, toolContext, {
          onServerEvent: (event) => this.handleDeepgramEvent(client, event),
          onError: (error) => {
            this.logger.error(error);
            client.emit('error', { message: error.message || 'Voice session error' });
          },
          onClose: () => {
            client.emit('voice_closed');
          },
        });
        client.emit('voice_ready');
      } catch (err: any) {
        this.logger.error(err);
        client.emit('error', { message: err?.message || 'Failed to start voice session' });
      }
    } else {
      if (client.voiceBusy) {
        return;
      }
      this.createSttSession(client);
    }
  }

  @SubscribeMessage('voice_client_chunk')
  onVoiceClientChunk(client: any, payload: { audio?: string }) {
    const session: ChatSession | undefined = client.session;
    if (!session) return;

    if (this.isGptVoicePipeline()) {
      const audio = payload?.audio;
      if (!audio) {
        client.emit('error', { message: 'audio is required' });
        return;
      }
      try {
        this.voiceRealtimeService.sendClientEvent(client.id, {
          type: 'input_audio_buffer.append',
          audio,
        });
      } catch (err: any) {
        this.logger.error(err);
        client.emit('error', { message: err?.message || 'Failed to send audio chunk' });
      }
      return;
    }

    if (this.isDeepgramVoicePipeline()) {
      const audio = payload?.audio;
      if (!audio || typeof audio !== 'string') return;
      try {
        this.deepgramVoiceAgentService.sendAudio(client.id, Buffer.from(audio, 'base64'));
      } catch (err: any) {
        this.logger.error(err);
      }
      return;
    }

    if (client.voiceBusy) return;
    let sttSession: ISttSession | undefined = client.sttSession;
    if (!sttSession) {
      sttSession = this.createSttSession(client) ?? undefined;
      if (!sttSession) return;
    }
    const base64 = payload?.audio;
    if (!base64 || typeof base64 !== 'string') return;
    const buffer = Buffer.from(base64, 'base64');
    sttSession.writeAudio(buffer);
    if (client._voiceStatistics) (client._voiceStatistics as VoiceTurnStatistics).lastAudioAt = Date.now();
  }

  @SubscribeMessage('voice_playback_done')
  onPlaybackDone(client: any) {
    if (this.isGptVoicePipeline()) {
      this.voiceRealtimeService.onPlaybackDone(client.id);
      client.emit('voice_ready');
    } else {
      client.voiceBusy = false;
      client.emit('voice_ready');
    }
  }

  @SubscribeMessage('voice_send_text')
  async onVoiceSendText(client: any, payload: { text: string }) {
    const session: ChatSession | undefined = client.session;
    if (!session) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    const textToSpeak = payload?.text?.trim();
    if (!textToSpeak) return;

    if (this.isGptVoicePipeline()) {
      // Immediately signal "Thinking…" so the animation starts before LLM responds
      client.emit('voice_turn_end');
      try {
        // Auto-create Realtime session if the user sent text (e.g. tapped a chip)
        // without ever tapping the mic — voice_start is never called in that flow.
        if (!this.voiceRealtimeService.hasSession(client.id)) {
          const toolContext = {
            account: session.account,
            bookingId: session.bookingId,
            chatId: session.chatId,
            hotel: session.hotel,
            booking: session.booking,
            languageCode: session.languageCode ?? null,
          };
          await this.voiceRealtimeService.createSession(client.id, toolContext, {
            onServerEvent: (event) => this.handleRealtimeEvent(client, event),
            onError: (error) => {
              this.logger.error(error);
              client.emit('error', { message: error.message || 'Voice session error' });
            },
            onClose: () => { client.emit('voice_closed'); },
          });
        }
        // Save text as user transcript so response.done persists it to DB
        this.voiceRealtimeService.setUserTranscript(client.id, textToSpeak);
        client.emit('voice_user_message', { text: textToSpeak });
        // sendClientEvent queues events internally until the OpenAI WS is open+configured
        this.voiceRealtimeService.sendClientEvent(client.id, {
          type: 'conversation.item.create',
          item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: textToSpeak }] },
        });
        this.voiceRealtimeService.sendClientEvent(client.id, { type: 'response.create' });
      } catch (err: any) {
        client.emit('error', { message: err?.message || 'Failed to inject text' });
      }
      return;
    }

    // Custom STT pipeline (and Deepgram voice agent fallback — direct LLM path)
    if (client.voiceBusy) return;

    client.voiceBusy = true;
    client.emit('voice_turn_end');
    client.emit('voice_user_message', { text: textToSpeak });

    const provider = this.ttsFactory.getProvider();
    const statistics: VoiceTurnStatistics = {
      lastAudioAt: Date.now(),
      responseStart: Date.now(),
      sttMs: 0,
      llmStart: Date.now(),
      llmMs: 0,
      ttsMs: 0,
      totalProcessingMs: 0,
    };
    const state = {
      sentenceBuffer: '',
      fullText: '',
      ttsQueue: Promise.resolve() as Promise<void>,
      statistics,
      languageCode: session.languageCode ?? null,
    };

    this.chatLlmService
      .streamUserMessage(session, textToSpeak, {
        mode: 'voice',
        onChunk: (chunk: string) => {
          if (!chunk) return;
          state.sentenceBuffer += chunk;
          this.flushCompletedSentencesToTts(state, client, provider);
        },
        onEnd: async (result) => {
          statistics.llmMs = Date.now() - statistics.llmStart;
          if (state.sentenceBuffer.trim().length > 0) {
            state.fullText += state.sentenceBuffer.trim();
            await state.ttsQueue;
            const t0 = Date.now();
            await provider.streamToClient(client, state.sentenceBuffer.trim(), { emitEnd: true, languageCode: state.languageCode });
            statistics.ttsMs += Date.now() - t0;
          } else {
            await state.ttsQueue;
            // All sentences were flushed with emitEnd:false — emit audio_end now so the
            // client's source.onended counter can resolve and voice_playback_done is sent.
            client.emit('voice_audio_end');
          }
          client.emit('voice_text_end', { text: result.fullContent || state.fullText });
          // voiceBusy reset and voice_ready are deferred to onPlaybackDone,
          // so the animation stays alive until the client finishes playing audio.
        },
      })
      .catch((err: any) => {
        this.loggerService.warn({ message: err?.message ?? String(err), traces: [{ error: 'voice_send_text LLM+TTS' }] });
        client.emit('error', { message: 'Voice response failed' });
        client.voiceBusy = false;
        client.emit('voice_ready');
      });
  }

  @SubscribeMessage('voice_stop')
  onVoiceStop(client: any) {
    const session: ChatSession | undefined = client.session;
    if (!session) return;
    if (this.isGptVoicePipeline()) {
      try {
        this.voiceRealtimeService.closeSession(client.id);
        client.emit('voice_closed');
      } catch (err: any) {
        this.logger.error(err);
        client.emit('error', { message: err?.message || 'Failed to stop voice session' });
      }
    } else if (this.isDeepgramVoicePipeline()) {
      try {
        this.deepgramVoiceAgentService.closeSession(client.id);
        client.emit('voice_closed');
      } catch (err: any) {
        this.logger.error(err);
        client.emit('error', { message: err?.message || 'Failed to stop voice session' });
      }
    } else {
      const sttSession: ISttSession | undefined = client.sttSession;
      if (sttSession) {
        sttSession.endInput();
        sttSession.destroy();
        client.sttSession = null;
      }
    }
  }

  private async handleRealtimeEvent(client: any, event: any) {
    const session = client.session as ChatSession | undefined;
    if (!session) return;

    switch (event.type) {
      case 'conversation.item.input_audio_transcription.completed': {
        const ev: any = event;
        const transcript = ev?.transcript;
        if (typeof transcript === 'string' && transcript.trim().length) {
          client.emit('voice_user_message', { text: transcript });
        }
        break;
      }
      case 'response.output_text.delta':
      case 'response.output_audio_transcript.delta':
        client.emit('voice_text_chunk', { delta: event.delta || '' });
        break;
      case 'response.done': {
        if (event._skipVoiceTextEnd) {
          break;
        }
        const { userTranscript, assistantText, toolCalls, usage } = this.voiceRealtimeService.consumeTranscriptsAndTools(client.id);

        const ev: any = event;
        const finalAssistantText =
          (assistantText && assistantText.trim().length ? assistantText : undefined) ??
          (typeof ev.output_text === 'string' ? ev.output_text : undefined) ??
          (typeof ev.output_audio_transcript === 'string' ? ev.output_audio_transcript : undefined) ??
          '';
        const cleanUser = userTranscript?.trim();
        const cleanAssistant = finalAssistantText?.trim();

        let assistantMessage: Message | null = null;
        try {
          if (cleanUser) {
            await this.messagesService.create(session.chatId, MessageRole.USER, cleanUser);
          }
          if (cleanAssistant) {
            assistantMessage = await this.messagesService.create(
              session.chatId,
              MessageRole.ASSISTANT,
              cleanAssistant,
              toolCalls.length ? toolCalls : undefined,
            );
          }
          await this.chatContextService.rebuildCache(session.chatId);
        } catch (err) {
          this.logger.error('Failed to persist voice messages', err as Error);
        }

        if (cleanAssistant) {
          this.costsService.recordLlmCost({
            type: CostType.LLM_VOICE,
            usage: {
              promptTokens: usage?.promptTokens ?? 0,
              completionTokens: usage?.completionTokens ?? 0,
              totalTokens: usage?.totalTokens ?? 0,
            },
            bookingId: session.bookingId,
            hotelId: session.booking ? session.booking.hotelId : null,
            accountId: session.account.id,
            role: session.account.role,
            chatId: session.chatId,
            messageId: assistantMessage ? assistantMessage.id : null,
          });
        }
        client.emit('voice_text_end', { text: finalAssistantText, toolCalls });
        break;
      }
      case 'response.output_audio.delta':
        client.emit('voice_audio_chunk', { delta: event.delta });
        break;
      case 'response.output_audio.done':
        client.emit('voice_audio_end');
        break;
      case 'error':
        client.emit('error', { message: event?.error?.message || 'Realtime error' });
        break;
      default:
        break;
    }
  }

  private async handleDeepgramEvent(client: any, event: any) {
    const session = client.session as ChatSession | undefined;
    if (!session) return;

    switch (event.type) {
      case 'audio_chunk':
        client.emit('voice_audio_chunk', { delta: (event.audio as Buffer).toString('base64') });
        break;
      case 'ConversationText':
        if (event.role === 'user') {
          client.emit('voice_user_message', { text: event.content });
        } else if (event.role === 'assistant') {
          client.emit('voice_text_chunk', { delta: event.content });
        }
        break;
      case 'AgentAudioDone': {
        const { userTranscript, assistantText, toolCalls } = this.deepgramVoiceAgentService.consumeTranscriptsAndTools(client.id);
        const cleanUser = userTranscript?.trim();
        const cleanAssistant = assistantText?.trim();

        let assistantMessage: Message | null = null;
        try {
          if (cleanUser) {
            await this.messagesService.create(session.chatId, MessageRole.USER, cleanUser);
          }
          if (cleanAssistant) {
            assistantMessage = await this.messagesService.create(
              session.chatId,
              MessageRole.ASSISTANT,
              cleanAssistant,
              toolCalls.length ? toolCalls : undefined,
            );
          }
          await this.chatContextService.rebuildCache(session.chatId);
        } catch (err) {
          this.logger.error('Failed to persist Deepgram voice messages', err as Error);
        }

        if (cleanAssistant) {
          this.costsService.recordLlmCost({
            type: CostType.LLM_VOICE,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            bookingId: session.bookingId,
            hotelId: session.booking ? session.booking.hotelId : null,
            accountId: session.account.id,
            role: session.account.role,
            chatId: session.chatId,
            messageId: assistantMessage ? assistantMessage.id : null,
          });
        }

        client.emit('voice_audio_end');
        client.emit('voice_text_end', { text: cleanAssistant ?? '', toolCalls });
        break;
      }
      case 'Error':
      case 'error':
        client.emit('error', { message: event?.description || event?.message || 'Deepgram Voice Agent error' });
        break;
      default:
        break;
    }
  }

  handleDisconnect(client: any) {
    if (this.isGptVoicePipeline()) {
      this.voiceRealtimeService.closeSession(client.id);
      delete client.session;
      delete client.sessionPending;
      return;
    }
    if (this.isDeepgramVoicePipeline()) {
      this.deepgramVoiceAgentService.closeSession(client.id);
      delete client.session;
      delete client.sessionPending;
      return;
    }
    const sttSession: ISttSession | undefined = client.sttSession;
    if (sttSession) {
      sttSession.destroy();
      client.sttSession = null;
    }
    if (client.voiceBusy) {
      client.voiceBusy = false;
    }
    delete client.session;
    delete client.sessionPending;
  }
}
