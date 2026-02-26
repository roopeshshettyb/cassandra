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
      let lastFinalTranscript = '';

      sttSession.onTranscript((text: string, isFinal?: boolean) => {
        // Log only on final utterance to avoid noisy partial logs,
        // but always stream text to the client for live transcript UX.
        if (isFinal) {
          this.logger.log(`[voice] transcript: ${text}`);
          lastFinalTranscript = text;
        }
        client.emit('voice_user_chunk', { delta: text, isFinal: !!isFinal });
      });

      sttSession.onEndOfSpeech(() => {
        this.logger.log('STT Ended');
        sttSession.endInput();
        if (client.sttSession === sttSession) {
          client.sttSession = null;
        }
        sttSession.destroy();
        client.emit('voice_turn_end');

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

        this.logger.log('LLM Inference Started');
        this.chatLlmService
          .streamUserMessage(session, textToSpeak, {
            onChunk: () => {},
            onEnd: async (result) => {
              this.logger.log('LLM Inference Ended');
              client.emit('voice_text_end', { text: result.fullContent });
              this.logger.log('TTS Started');
              await provider.streamToClient(client, result.fullContent);
            },
          })
          .catch((err: any) => {
            this.logger.warn('[VoiceGateway] LLM+TTS error', err && err.message ? err.message : err);
            client.emit('error', { message: 'Voice response failed' });
            client.emit('voice_ready');
            client.voiceBusy = false;
          });
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
