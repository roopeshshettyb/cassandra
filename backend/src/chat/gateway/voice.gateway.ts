import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Injectable } from '@nestjs/common';
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

  constructor(
    private readonly authService: AuthService,
    private readonly chatService: ChatService,
    private readonly bookingsService: BookingsService,
    private readonly constantsService: ConstantsService,
    private readonly logger: LoggerService,
    private readonly sttFactory: SttFactoryService,
    private readonly ttsFactory: TtsFactoryService,
    private readonly chatLlmService: ChatLlmService,
  ) {}

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
    state: { sentenceBuffer: string; fullText: string; ttsQueue: Promise<void>; statistics: VoiceTurnStatistics },
    client: any,
    provider: { streamToClient: (client: any, text: string, options?: { emitEnd?: boolean }) => Promise<void> },
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
        await provider.streamToClient(client, sentence, { emitEnd: false });
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
                await provider.streamToClient(client, state.sentenceBuffer.trim(), { emitEnd: true });
                state.statistics.ttsMs += Date.now() - t0;
              } else {
                await state.ttsQueue;
              }
              state.statistics.totalProcessingMs = Date.now() - state.statistics.responseStart;
              this.logger.log({
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
            this.logger.warn({
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
      this.logger.error({
        error: err,
        traces: [{ stage: 'STT session' }],
      });
      client.emit('error', { message: err?.message || 'STT session failed' });
      return null;
    }
  }

  @SubscribeMessage('voice_start')
  onVoiceStart(client: any) {
    const session: ChatSession | undefined = client.session;
    if (!session) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    if (client.voiceBusy) {
      return;
    }
    this.createSttSession(client);
  }

  @SubscribeMessage('voice_client_chunk')
  onVoiceClientChunk(client: any, payload: { audio?: string }) {
    const session: ChatSession | undefined = client.session;
    if (!session) return;
    if (client.voiceBusy) return;
    let sttSession: ISttSession | undefined = client.sttSession;
    if (!sttSession) {
      sttSession = this.createSttSession(client) ?? undefined;
      if (!sttSession) return;
    }
    const base64 = payload?.audio;
    if (!base64 || typeof base64 !== 'string') return;
    try {
      const buffer = Buffer.from(base64, 'base64');
      sttSession.writeAudio(buffer);
      if (client._voiceStatistics) (client._voiceStatistics as VoiceTurnStatistics).lastAudioAt = Date.now();
    } catch (_) {}
  }

  @SubscribeMessage('voice_stop')
  onVoiceStop(client: any) {
    const session: ChatSession | undefined = client.session;
    if (!session) return;
    const sttSession: ISttSession | undefined = client.sttSession;
    if (sttSession) {
      sttSession.endInput();
      sttSession.destroy();
      client.sttSession = null;
    }
  }

  handleDisconnect(client: any) {
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
