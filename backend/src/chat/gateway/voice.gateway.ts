import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../../auth/auth.service';
import { ChatService } from '../chat.service';
import { ChatSession } from './chat-session.interface';
import { BookingsService } from '../../bookings/bookings.service';
import { ConstantsService } from '../../common/constants/constants.service';
import { SttFactoryService } from '../../stt/stt-factory.service';
import type { ISttSession } from '../../stt/stt-session.interface';
import { TtsFactoryService } from '../../tts/tts-factory.service';
import { ChatLlmService } from '../chat-llm.service';
import { parseConnectionHandshake, authenticateBookingAndInit } from './gateway-auth.helper';

// Auto-trigger LLM when accumulated transcript reaches this length (characters)
const TRANSCRIPT_CHAR_LIMIT = 300;

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
   * Runs the LLM + TTS pipeline for a completed voice turn.
   * Emits voice_turn_end, voice_user_message, then triggers LLM→TTS.
   */
  private processVoiceTurn(client: any, text: string) {
    client.emit('voice_turn_end');

    const session: ChatSession | undefined = client.session;
    if (!session) {
      client.emit('error', { message: 'Not authenticated' });
      client.emit('voice_ready');
      return;
    }

    if (!text || typeof text !== 'string') {
      client.emit('voice_ready');
      return;
    }

    client.emit('voice_user_message', { text });

    client.voiceBusy = true;
    client.lastTranscript = '';
    const provider = this.ttsFactory.getProvider();

    const llmStart = Date.now();
    this.logger.log('[Timing] LLM start');
    this.chatLlmService
      .streamUserMessage(session, text, {
        isVoice: true,
        onChunk: () => {},
        onEnd: async (result) => {
          const llmMs = Date.now() - llmStart;
          this.logger.log(`[Timing] LLM done: ${llmMs}ms`);
          client.emit('voice_text_end', { text: result.fullContent });
          const ttsStart = Date.now();
          this.logger.log('[Timing] TTS start');
          await provider.streamToClient(client, result.fullContent);
          this.logger.log(`[Timing] TTS done: ${Date.now() - ttsStart}ms`);
        },
      })
      .catch((err: any) => {
        this.logger.error(`[VoiceGateway] LLM+TTS error: ${err?.message ?? err}`);
        if (err?.stack) this.logger.error(err.stack);
        client.emit('error', { message: 'Voice response failed' });
        client.emit('voice_ready');
        client.voiceBusy = false;
      });
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
      const sttSession: ISttSession = factory.createSession({ language: client.session?.languageCode });
      client.sttSession = sttSession;
      client.lastTranscript = '';
      const sttStart = Date.now();
      this.logger.log('[Timing] STT session created');

      sttSession.onTranscript((text: string, isFinal?: boolean) => {
        if (isFinal) {
          // isFinal = Deepgram is_final: accumulate into lastTranscript
          client.lastTranscript = (client.lastTranscript || '') + ' ' + text;
          client.lastTranscript = client.lastTranscript.trim();
          this.logger.log(`[voice] transcript chunk (final): ${text} | total: ${client.lastTranscript.length} chars`);
        }
        client.emit('voice_user_chunk', { delta: text, isFinal: !!isFinal });

        // Auto-trigger when accumulated transcript exceeds character limit
        if (isFinal && client.lastTranscript && client.lastTranscript.length >= TRANSCRIPT_CHAR_LIMIT) {
          this.logger.log(`[voice] char limit reached (${client.lastTranscript.length} chars), auto-triggering response`);
          const textToProcess = client.lastTranscript;
          sttSession.endInput();
          if (client.sttSession === sttSession) {
            client.sttSession = null;
          }
          sttSession.destroy();
          this.processVoiceTurn(client, textToProcess);
        }
      });

      sttSession.onEndOfSpeech(() => {
        this.logger.log(`[Timing] STT done (includes speaking time + silence wait): ${Date.now() - sttStart}ms`);
        // Guard: session may have already been destroyed by char limit trigger
        if (client.sttSession !== sttSession) return;

        sttSession.endInput();
        client.sttSession = null;
        sttSession.destroy();

        const textToProcess = client.lastTranscript;
        this.processVoiceTurn(client, textToProcess);
      });

      return sttSession;
    } catch (err: any) {
      this.logger.error(err);
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
    } catch (_) {}
  }

  @SubscribeMessage('voice_stop')
  onVoiceStop(client: any) {
    const session: ChatSession | undefined = client.session;
    if (!session) return;
    const sttSession: ISttSession | undefined = client.sttSession;
    if (sttSession) {
      this.logger.log('user stopped (manual)');
      sttSession.endInput();
      sttSession.destroy();
      client.sttSession = null;
    }

    // Trigger LLM with whatever was transcribed so far (if not already busy)
    if (!client.voiceBusy) {
      const text: string = client.lastTranscript ?? '';
      this.processVoiceTurn(client, text);
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
    delete client.lastTranscript;
  }
}
