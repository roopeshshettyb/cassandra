import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../../auth/auth.service';
import { ChatService } from '../chat.service';
import { MessagesService } from '../../messages/messages.service';
import { Chat } from '../chat.model';
import { ChatContextService } from '../../chat-context/chat-context.service';
import { LangGraphService, ToolCallRecord } from '../../langgraph/langgraph.service';
import { ChatSession } from './chat-session.interface';
import { BookingsService } from '../../bookings/bookings.service';
import { buildChatPrompt } from '../chat-prompt.builder';
import { ConstantsService } from '../../common/constants/constants.service';
import { CostsService } from '../../costs/costs.service';
import { CostType } from '../../costs/costs.model';
import { parseConnectionHandshake, authenticateAndInit } from './gateway-auth.helper';
import { ChatLlmService } from '../chat-llm.service';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

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
    private readonly chatLlmService: ChatLlmService,
  ) {}

  private async emitChatHistory(client: any, session: ChatSession): Promise<void> {
    const chats = await this.chatService.listHistoryForSession(session.account, session.bookingId);
    const history: Array<{ id: number; createdAt: Date; chatType: string; bookingId: number | null; title: string }> = [];
    for (const chat of chats) {
      const title = chat.chatName && chat.chatName.trim().length > 0 ? chat.chatName.trim() : 'New chat';
      //push
      history.push({
        id: chat.id,
        createdAt: chat.createdAt,
        chatType: chat.chatType,
        bookingId: chat.bookingId ?? null,
        title,
      });
    }
    client.emit('chat_history', { chats: history, currentChatId: session.chatId });
  }

  private async emitReadyAndHistory(client: any, session: ChatSession): Promise<void> {
    const messages = await this.messagesService.findRecentByChatId(session.chatId, 50);
    client.emit('ready', { chatId: session.chatId, messages });
    await this.emitChatHistory(client, session);
  }

  private async maybeGenerateChatName(session: ChatSession): Promise<void> {
    const chat = await this.chatService.findByIdForAccount(session.account, session.chatId);
    if (!chat || (chat.chatName && chat.chatName.trim().length > 0)) {
      return;
    }
    const messageCount = await this.messagesService.countByChatId(session.chatId);
    if (messageCount < 2) {
      return;
    }
    const recent = await this.messagesService.findRecentByChatId(session.chatId, 8);
    let transcript = '';
    for (const row of recent) {
      const role = row.role === 'assistant' ? 'Assistant' : 'User';
      const content = row.content ? row.content.trim() : '';
      if (!content) {
        continue;
      }
      transcript = `${transcript}${role}: ${content}\n`;
    }
    if (!transcript) {
      return;
    }
    const messages = [
      new SystemMessage('Generate a conversation title in exactly three words. Return only the three words.'),
      new HumanMessage(transcript),
    ];
    const rawTitle = (await this.langGraphService.invoke(messages, 0)).trim();
    const cleaned = rawTitle.replace(/[^A-Za-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const parts = cleaned ? cleaned.split(' ') : [];
    const selected: string[] = [];
    for (let i = 0; i < parts.length && selected.length < 3; i += 1) {
      const p = parts[i].trim();
      if (!p) {
        continue;
      }
      selected.push(p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
    }
    if (selected.length < 3) {
      return;
    }
    await this.chatService.updateChatName(session.chatId, selected.join(' '), session.account);
  }

  async handleConnection(client: any) {
    const { token, bookingId } = parseConnectionHandshake(client);
    if (!token) {
      client.sessionPending = { token: null, bookingId: null };
      client.emit('auth_required', { message: 'Send auth with token' });
      return;
    }

    await authenticateAndInit(
      client,
      token,
      bookingId,
      {
        authService: this.authService,
        chatService: this.chatService,
        bookingsService: this.bookingsService,
        constantsService: this.constantsService,
      },
      async (session) => {
        await this.emitReadyAndHistory(client, session);
      },
    );
  }

  @SubscribeMessage('auth')
  async onAuth(client: any, payload: { token: string; bookingId?: number | null }) {
    if (client.session) {
      client.emit('error', { message: 'Already authenticated' });
      return;
    }
    const token = payload?.token;
    const bookingIdRaw = payload?.bookingId;
    const bookingId = typeof bookingIdRaw === 'number' && bookingIdRaw > 0 ? bookingIdRaw : undefined;
    if (!token) {
      client.emit('error', { message: 'auth requires token' });
      return;
    }
    await authenticateAndInit(
      client,
      token,
      bookingId,
      {
        authService: this.authService,
        chatService: this.chatService,
        bookingsService: this.bookingsService,
        constantsService: this.constantsService,
      },
      async (session) => {
        await this.emitReadyAndHistory(client, session);
      },
    );
  }

  @SubscribeMessage('get_chat_history')
  async onGetChatHistory(client: any) {
    const session: ChatSession | undefined = client.session;
    if (!session) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    await this.emitReadyAndHistory(client, session);
  }

  @SubscribeMessage('new_chat')
  async onNewChat(client: any) {
    const session: ChatSession | undefined = client.session;
    if (!session) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    const chat: Chat = await this.chatService.createNewForSession(session.account, session.bookingId);
    session.chatId = chat.id;
    session.languageCode = chat.languageCode ?? null;
    await this.emitReadyAndHistory(client, session);
  }

  @SubscribeMessage('open_chat')
  async onOpenChat(client: any, payload: { chatId: number }) {
    const session: ChatSession | undefined = client.session;
    if (!session) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    const chatId = payload?.chatId;
    if (!chatId || typeof chatId !== 'number') {
      client.emit('error', { message: 'chatId is required' });
      return;
    }
    const chat = await this.chatService.findByIdForSessionScope(session.account, chatId, session.bookingId);
    if (!chat) {
      client.emit('error', { message: 'Chat not found' });
      return;
    }
    session.chatId = chat.id;
    session.languageCode = chat.languageCode ?? null;
    await this.emitReadyAndHistory(client, session);
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
      await this.chatLlmService.streamUserMessage(session, content, {
        mode: 'text',
        onChunk: async (chunk: string) => {
          client.emit('stream_chunk', { content: chunk });
        },
        onEnd: async (result: { fullContent: string; toolCalls: ToolCallRecord[] }) => {
          client.emit('stream_end', { content: result.fullContent, toolCalls: result.toolCalls });
        },
      });
      await this.maybeGenerateChatName(session);
      await this.emitChatHistory(client, session);
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
