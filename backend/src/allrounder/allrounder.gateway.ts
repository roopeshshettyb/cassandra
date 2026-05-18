import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { HotelsService } from '../hotels/hotels.service';
import { AllRounderSession } from './allrounder-session.interface';
import { parseAllRounderHandshake, authenticateAllRounderAndInit } from './allrounder-auth.helper';
import { LangGraphService, ToolCallRecord } from '../langgraph/langgraph.service';
import { ChatContextService } from '../chat-context/chat-context.service';
import { ChatService } from '../chat/chat.service';
import { MessageRole } from '../messages/message.model';
import { buildSystemInstructions } from '../chat/chat-prompt.builder';
import { ConstantsService } from '../common/constants/constants.service';

export interface AgentCard {
  type: 'request' | 'booking' | 'stat' | 'hotel';
  title: string;
  subtitle?: string;
  badge?: string;
  route?: string;
  meta?: Record<string, unknown>;
}

@WebSocketGateway({ cors: true, namespace: '/allrounder' })
@Injectable()
export class AllRounderGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AllRounderGateway.name);

  constructor(
    private readonly authService: AuthService,
    private readonly hotelsService: HotelsService,
    private readonly chatService: ChatService,
    private readonly langGraphService: LangGraphService,
    private readonly chatContextService: ChatContextService,
    private readonly constantsService: ConstantsService,
  ) {}

  async handleConnection(client: any) {
    const { token } = parseAllRounderHandshake(client);
    if (token) {
      await authenticateAllRounderAndInit(
        client,
        token,
        { authService: this.authService, hotelsService: this.hotelsService, chatService: this.chatService },
        async (_session, recentMessages) => {
          client.emit('ready', { messages: recentMessages });
        },
      );
    } else {
      client.sessionPending = true;
      client.emit('auth_required', { message: 'Send auth with token' });
    }
  }

  @SubscribeMessage('auth')
  async onAuth(client: any, payload: { token: string }) {
    if (client.session) { client.emit('error', { message: 'Already authenticated' }); return; }
    const token = payload?.token;
    if (!token) { client.emit('error', { message: 'auth requires token' }); return; }
    await authenticateAllRounderAndInit(
      client,
      token,
      { authService: this.authService, hotelsService: this.hotelsService, chatService: this.chatService },
      async (_session, recentMessages) => {
        client.emit('ready', { messages: recentMessages });
      },
    );
  }

  @SubscribeMessage('message')
  async onMessage(client: any, payload: { content: string }) {
    const session: AllRounderSession | undefined = client.session;
    if (!session) { client.emit('error', { message: 'Not authenticated' }); return; }
    const content = payload?.content?.trim();
    if (!content) { client.emit('error', { message: 'content is required' }); return; }

    try {
      const appName = this.constantsService.public.APP_NAME;

      // Sync history to Redis so buildSystemInstructions picks it up
      const recentMessages = await this.chatService.getAllRounderMessages(session.chatId, 20);
      const contextStr = this.chatService.buildAllRounderContextString(recentMessages);
      this.chatContextService.setContextString(session.chatId, contextStr);

      const { instructions } = await buildSystemInstructions(
        this.chatContextService,
        session.chatId,
        appName,
        session.hotelContext,
        session.account.role,
        session.languageCode,
        false,
      );

      const promptMessages = [...instructions, { role: 'user' as const, content }];

      // AgentToolContext with scopedHotelIds signals LangGraphService to include AllRounder tools
      const ctx = {
        account: session.account,
        bookingId: null,
        chatId: session.chatId,
        hotel: null,
        booking: null,
        scopedHotelIds: session.scopedHotelIds,
        hotelContext: session.hotelContext,
      };

      let fullContent = '';
      const toolCalls: ToolCallRecord[] = [];

      for await (const chunk of this.langGraphService.stream({ messages: promptMessages }, ctx)) {
        if (typeof chunk === 'string') {
          fullContent += chunk;
          client.emit('stream_chunk', { content: chunk });
        } else {
          for (const tc of chunk.toolCalls) toolCalls.push(tc);
        }
      }

      // Update session language if agent called set_chat_language
      for (const tc of toolCalls) {
        if (tc.toolName === 'set_chat_language' && tc.input?.languageCode) {
          session.languageCode = String(tc.input.languageCode);
        }
      }

      const cards = this.extractCards(toolCalls);

      // If cards present: keep full text only for short disambiguation questions (<200 chars with ?), clip everything else
      let displayContent = fullContent;
      if (cards.length > 0) {
        const isShortQuestion = fullContent.includes('?') && fullContent.trim().length < 200;
        if (!isShortQuestion) {
          const typeLabel = cards[0].type === 'hotel' ? 'hotels' : cards[0].type === 'request' ? 'requests' : cards[0].type === 'booking' ? 'bookings' : cards[0].type === 'stat' ? 'stats' : 'results';
          displayContent = fullContent.trim().split(/[.!?]/)[0].trim() || `Here are your ${typeLabel}.`;
          if (displayContent.length > 80) displayContent = `Here are your ${typeLabel}.`;
        }
      }

      const options = cards.length === 0 ? this.extractOptions(fullContent) : [];
      client.emit('stream_end', { content: displayContent, toolCalls, cards, options });

      // Persist to DB
      await this.chatService.saveAllRounderMessage(session.chatId, MessageRole.USER, content);
      await this.chatService.saveAllRounderMessage(session.chatId, MessageRole.ASSISTANT, fullContent, toolCalls.length ? toolCalls : undefined);
    } catch (err: any) {
      this.logger.error(err);
      client.emit('error', { message: err?.message || 'Message failed' });
    }
  }

  @SubscribeMessage('new_chat')
  async onNewChat(client: any) {
    const session: AllRounderSession | undefined = client.session;
    if (!session) { client.emit('error', { message: 'Not authenticated' }); return; }
    try {
      const newChat = await this.chatService.createAllRounderChat(session.account.id);
      session.chatId = newChat.id;
      client.emit('chat_created', { chatId: newChat.id });
    } catch (err: any) {
      this.logger.error(err);
      client.emit('error', { message: err?.message || 'Failed to create new chat' });
    }
  }

  @SubscribeMessage('list_chats')
  async onListChats(client: any) {
    const session: AllRounderSession | undefined = client.session;
    if (!session) { client.emit('error', { message: 'Not authenticated' }); return; }
    try {
      const chats = await this.chatService.listAllRounderChats(session.account.id);
      client.emit('chats_list', { chats, activeChatId: session.chatId });
    } catch (err: any) {
      this.logger.error(err);
      client.emit('error', { message: err?.message || 'Failed to list chats' });
    }
  }

  @SubscribeMessage('switch_chat')
  async onSwitchChat(client: any, payload: { chatId: number }) {
    const session: AllRounderSession | undefined = client.session;
    if (!session) { client.emit('error', { message: 'Not authenticated' }); return; }
    try {
      const chatId = payload?.chatId;
      if (!chatId) { client.emit('error', { message: 'chatId required' }); return; }
      const chats = await this.chatService.listAllRounderChats(session.account.id);
      if (!chats.find((c) => c.id === chatId)) {
        client.emit('error', { message: 'Chat not found or no access' });
        return;
      }
      const messages = await this.chatService.getAllRounderMessages(chatId, 50);
      session.chatId = chatId;
      client.emit('chat_switched', { chatId, messages });
    } catch (err: any) {
      this.logger.error(err);
      client.emit('error', { message: err?.message || 'Failed to switch chat' });
    }
  }

  handleDisconnect(client: any) {
    client.session = undefined;
  }

  private extractOptions(text: string): string[] {
    const lines = text.split('\n');
    const opts: string[] = [];
    for (const line of lines) {
      const m = line.match(/^\d+\.\s+(.+)$/);
      if (m) opts.push(m[1].trim());
    }
    return opts.length >= 2 ? opts : [];
  }

  private extractCards(toolCalls: ToolCallRecord[]): AgentCard[] {
    const cards: AgentCard[] = [];
    for (const tc of toolCalls) {
      if (!tc.output) continue;
      let parsed: any;
      try { parsed = typeof tc.output === 'string' ? JSON.parse(tc.output) : tc.output; } catch { continue; }
      const items: any[] = Array.isArray(parsed) ? parsed : parsed?.stats ? parsed.stats : [];
      for (const item of items) {
        if (!item._card_type) continue;
        if (item._card_type === 'request') {
          const roomPart = item.roomNumber ? ` · Room ${item.roomNumber}` : '';
          cards.push({ type: 'request', title: `${String(item.requestType ?? '').replace(/_/g, ' ')} — ${item.guestName ?? 'Guest'}`, subtitle: `${item.hotelName ?? ''}${roomPart}` || undefined, badge: item.urgency, route: `/requests/${item.id}`, meta: { status: item.status, urgency: item.urgency } });
        } else if (item._card_type === 'booking') {
          const checkIn = item.startTime ? new Date(item.startTime).toLocaleDateString() : '';
          const roomLabel = item.roomNumber ? `Room ${item.roomNumber}` : 'No room assigned';
          cards.push({ type: 'booking', title: item.guestName ?? roomLabel, subtitle: `${roomLabel} · ${checkIn}`, route: `/bookings/${item.id}`, meta: { bookingId: item.id } });
        } else if (item._card_type === 'hotel') {
          cards.push({ type: 'hotel', title: item.name, subtitle: item.address, route: `/hotels/${item.id}`, meta: { hotelId: item.id } });
        } else if (item._card_type === 'stat') {
          cards.push({ type: 'stat', title: String(item.value ?? ''), subtitle: item.label, meta: {} });
        }
      }
    }
    return cards;
  }
}
