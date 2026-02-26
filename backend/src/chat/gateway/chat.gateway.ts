import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../../auth/auth.service';
import { ChatService } from '../chat.service';
import { MessagesService } from '../../messages/messages.service';
import { Message, MessageRole } from '../../messages/message.model';
import { ChatContextService } from '../../chat-context/chat-context.service';
import { LangGraphService, ToolCallRecord } from '../../langgraph/langgraph.service';
import { ChatSession } from './chat-session.interface';
import { BookingsService } from '../../bookings/bookings.service';
import { buildChatPrompt } from '../chat-prompt.builder';
import { ConstantsService } from '../../common/constants/constants.service';
import { CostsService } from '../../costs/costs.service';
import { CostType } from '../../costs/costs.model';
import { parseConnectionHandshake, authenticateBookingAndInit } from './gateway-auth.helper';

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
    private readonly constantsService: ConstantsService,
    private readonly costsService: CostsService,
  ) {}

  async handleConnection(client: any) {
    const { token, bookingId } = parseConnectionHandshake(client);
    if (token && bookingId !== undefined) {
      await authenticateBookingAndInit(client, token, bookingId, {
        authService: this.authService,
        chatService: this.chatService,
        bookingsService: this.bookingsService,
        constantsService: this.constantsService,
      }, async (session) => {
        const messages = await this.messagesService.findRecentByChatId(session.chatId, 50);
        client.emit('ready', { chatId: session.chatId, messages });
      });
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
    await authenticateBookingAndInit(client, token, bookingId, {
      authService: this.authService,
      chatService: this.chatService,
      bookingsService: this.bookingsService,
      constantsService: this.constantsService,
    }, async (session) => {
      const messages = await this.messagesService.findRecentByChatId(session.chatId, 50);
      client.emit('ready', { chatId: session.chatId, messages });
    });
  }

  async processMessage(chatId: any, userMessage: string, account: any, llmInstructions?: string | null, languageCode?: string | null): Promise<any> {
    const appName = this.constantsService.public.APP_NAME;
    const { contextData, messages } = await buildChatPrompt(this.chatContextService, chatId, userMessage, appName, account?.role, llmInstructions, languageCode);
    return { contextData, messages };
  }

  @SubscribeMessage('message')
  async onMessage(client: any, payload: { content: string }) {
    const session: ChatSession | undefined = client.session;
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
      const hotel = session.hotel;
      const llmInstructions = hotel?.llmInstructions;
      const { messages } = await this.processMessage(session.chatId, content, session.account, llmInstructions, session.languageCode ?? null);

      const toolContext = {
        account: session.account,
        bookingId: session.bookingId,
        chatId: session.chatId,
        hotel: session.hotel,
        booking: session.booking,
        languageCode: session.languageCode ?? null,
      };

      let fullContent = '';
      let toolCalls: ToolCallRecord[] = [];
      let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null = null;

      for await (const chunk of this.langGraphService.stream({ messages }, toolContext)) {
        if (typeof chunk === 'string') {
          fullContent += chunk;
          client.emit('stream_chunk', { content: chunk });
        } else if (chunk && typeof chunk === 'object') {
          if ('toolCalls' in chunk) {
            toolCalls = (chunk as { toolCalls: ToolCallRecord[] }).toolCalls;
          }
          if ('usage' in chunk && (chunk as { usage?: unknown }).usage) {
            const u = (chunk as { usage: { promptTokens: number; completionTokens: number; totalTokens: number } }).usage;
            usage = u;
          }
        }
      }

      const assistantMessage: Message = await this.messagesService.create(session.chatId, MessageRole.ASSISTANT, fullContent, toolCalls.length ? toolCalls : undefined);
      this.chatContextService.rebuildCache(session.chatId);
      client.emit('stream_end', { content: fullContent, toolCalls });

      this.costsService.recordLlmCost({
        type: CostType.LLM_CHAT,
        usage: {
          promptTokens: usage?.promptTokens ?? 0,
          completionTokens: usage?.completionTokens ?? 0,
          totalTokens: usage?.totalTokens ?? 0,
        },
        bookingId: session.bookingId,
        hotelId: session?.booking?.hotelId ?? null,
        accountId: session.account.id,
        role: session.account.role,
        chatId: session.chatId,
        messageId: assistantMessage.id,
      });
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
