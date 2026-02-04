import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../../auth/auth.service';
import { ChatService } from '../chat.service';
import { MessagesService } from '../../messages/messages.service';
import { MessageRole } from '../../messages/message.model';
import { ChatContextService } from '../../chat-context/chat-context.service';
import { LangGraphService, ToolCallRecord } from '../../langgraph/langgraph.service';
import { ChatSession } from './chat-session.interface';
import { BookingsService } from '../../bookings/bookings.service';
import { buildChatPrompt } from '../chat-prompt.builder';

@WebSocketGateway({ cors: true, namespace: '/chat' })
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly authService: AuthService,
    private readonly chatService: ChatService,
    private readonly messagesService: MessagesService,
    private readonly chatContextService: ChatContextService,
    private readonly langGraphService: LangGraphService,
    private readonly bookingsService: BookingsService,
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

  async processMessage(chatId: any, userMessage: string): Promise<any> {
    const { contextData, messages } = await buildChatPrompt(this.chatContextService, chatId, userMessage);

    return {
      contextData,
      messages,
    };
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
    // Placeholder: OpenAI Realtime API server-side proxy to be implemented.
    // Same session (account, bookingId, chatId) and tools will be used for voice.
    client.emit('voice_ready', { message: 'Voice not yet implemented; use text for now' });
  }

  @SubscribeMessage('message')
  async onMessage(client: any, payload: { content: string }) {
    const session = client.session as ChatSession | undefined;
    if (!session) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    const content = payload?.content?.trim();
    if (!content) {
      client.emit('error', { message: 'content is required' });
      return;
    }

    try {
      await this.messagesService.create(session.chatId, MessageRole.USER, content);
      const { messages } = await this.processMessage(session.chatId, content);

      const toolContext = {
        account: session.account,
        bookingId: session.bookingId,
        chatId: session.chatId,
        hotel: session.hotel,
        booking: session.booking,
      };

      let fullContent = '';
      let toolCalls: ToolCallRecord[] = [];

      for await (const chunk of this.langGraphService.stream({ messages }, toolContext)) {
        if (typeof chunk === 'string') {
          fullContent += chunk;
          client.emit('stream_chunk', { content: chunk });
        } else if (chunk && typeof chunk === 'object' && 'toolCalls' in chunk) {
          toolCalls = (chunk as { toolCalls: ToolCallRecord[] }).toolCalls;
        }
      }

      await this.messagesService.create(session.chatId, MessageRole.ASSISTANT, fullContent, toolCalls.length ? toolCalls : undefined);
      this.chatContextService.rebuildCache(session.chatId);
      client.emit('stream_end', { content: fullContent, toolCalls });
    } catch (err: any) {
      this.logger.error(err);
      client.emit('error', { message: err?.message || 'Message failed' });
    }
  }

  handleDisconnect(client: any) {
    delete client.session;
    delete client.sessionPending;
  }
}
