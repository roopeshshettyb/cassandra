import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../../auth/auth.service';
import { ChatService } from '../chat.service';
import { MessagesService } from '../../messages/messages.service';
import { MessageRole } from '../../messages/message.model';
import { ChatContextService } from '../../chat-context/chat-context.service';
import { ChatSession } from './chat-session.interface';
import { BookingsService } from '../../bookings/bookings.service';
import { VoiceRealtimeService } from '../voice-realtime.service';

@WebSocketGateway({ cors: true, namespace: '/voice' })
@Injectable()
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VoiceGateway.name);

  constructor(
    private readonly authService: AuthService,
    private readonly chatService: ChatService,
    private readonly messagesService: MessagesService,
    private readonly chatContextService: ChatContextService,
    private readonly bookingsService: BookingsService,
    private readonly voiceRealtimeService: VoiceRealtimeService,
  ) {}

  async handleConnection(client: any) {
    const auth: any = client.handshake?.auth;
    const token = (client.handshake?.query?.token as string) || auth?.token;
    const bookingIdRaw = client.handshake?.query?.bookingId as string;
    const bookingId = bookingIdRaw ? parseInt(bookingIdRaw, 10) : undefined;

    if (token && bookingId && !isNaN(bookingId)) {
      await this.authenticateAndInit(client, token, bookingId);
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
    const { token, bookingId } = payload || {};
    if (!token || !bookingId) {
      client.emit('error', { message: 'auth requires token and bookingId' });
      return;
    }
    await this.authenticateAndInit(client, token, bookingId);
  }

  private async authenticateAndInit(client: any, token: string, bookingId: number): Promise<void> {
    try {
      const account = await this.authService.verifyToken(token);
      if (!account) {
        client.emit('error', { code: 'UNAUTHORIZED', message: 'Invalid token' });
        client.disconnect(true);
        return;
      }

      const chat = await this.chatService.findOrCreateForBooking(bookingId, account);
      const { data: booking } = await this.bookingsService.findByIdForAccount(bookingId, account);
      const hotelModel: any = booking.hotel;
      const bookingModel: any = booking;
      const hotel = hotelModel ? hotelModel.get({ plain: true }) : null;
      const bookingPlain = bookingModel.get({ plain: true });
      const messages = await this.messagesService.findRecentByChatId(chat.id, 50);
      const session: ChatSession = {
        account,
        bookingId,
        chatId: chat.id,
        hotel,
        booking: bookingPlain,
      };
      client.session = session;
      delete client.sessionPending;

      client.emit('ready', {
        chatId: chat.id,
        messages: messages,
      });
    } catch (err: any) {
      this.logger.warn(err);
      if (err?.statusCode === 403 || err?.message?.includes('Forbidden')) {
        client.emit('error', { code: 'FORBIDDEN', message: 'No access to this booking' });
      } else {
        client.emit('error', { code: 'ERROR', message: err?.message || 'Setup failed' });
      }
      client.disconnect(true);
    }
  }

  @SubscribeMessage('voice_start')
  async onVoiceStart(client: any) {
    const session = client.session as ChatSession | undefined;
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
    };

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
  }

  @SubscribeMessage('voice_client_chunk')
  async onVoiceClientChunk(client: any, payload: { audio: string }) {
    const session = client.session as ChatSession | undefined;
    if (!session) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
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
  }

  @SubscribeMessage('voice_stop')
  async onVoiceStop(client: any) {
    const session = client.session as ChatSession | undefined;
    if (!session) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      // Stop the realtime voice session completely. The model is already
      // managing turns via server VAD and has created responses as needed.
      this.voiceRealtimeService.closeSession(client.id);
      client.emit('voice_closed');
    } catch (err: any) {
      this.logger.error(err);
      client.emit('error', { message: err?.message || 'Failed to stop voice session' });
    }
  }

  private async handleRealtimeEvent(client: any, event: any) {
    const session = client.session as ChatSession | undefined;
    if (!session) return;

    switch (event.type) {
      case 'conversation.item.input_audio_transcription.completed': {
        const transcript = (event as any)?.transcript;
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
        const { userTranscript, assistantText, toolCalls } = this.voiceRealtimeService.consumeTranscriptsAndTools(
          client.id,
        );

        const finalAssistantText =
          (assistantText && assistantText.trim().length ? assistantText : undefined) ??
          (typeof (event as any).output_text === 'string' ? (event as any).output_text : undefined) ??
          (typeof (event as any).output_audio_transcript === 'string'
            ? (event as any).output_audio_transcript
            : undefined) ??
          '';
        const cleanUser = userTranscript?.trim();
        const cleanAssistant = finalAssistantText?.trim();

        try {
          if (cleanUser) {
            await this.messagesService.create(session.chatId, MessageRole.USER, cleanUser);
          }
          if (cleanAssistant) {
            await this.messagesService.create(
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
        // Other events are ignored or could be forwarded for debugging if needed.
        break;
    }
  }

  handleDisconnect(client: any) {
    this.voiceRealtimeService.closeSession(client.id);
    delete client.session;
    delete client.sessionPending;
  }
}

