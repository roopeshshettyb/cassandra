import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { CHAT_REPOSITORY } from './chat.repository';
import { Chat } from './chat.model';
import { Account } from '../accounts/accounts.model';
import { BookingsService } from '../bookings/bookings.service';
import { MessagesService } from '../messages/messages.service';
import { MessageRole, ToolCallRecord } from '../messages/message.model';

@Injectable()
export class ChatService {
  constructor(
    @Inject(CHAT_REPOSITORY) private readonly chatRepository: typeof Chat,
    @Inject(forwardRef(() => BookingsService)) private readonly bookingsService: BookingsService,
    private readonly messagesService: MessagesService,
  ) {}

  async getMostRecentChatForBooking(bookingId: number): Promise<Chat | null> {
    return this.chatRepository.findOne({
      where: { bookingId },
      order: [['createdAt', 'DESC']],
    });
  }

  async findOrCreateForBooking(bookingId: number, account: Account): Promise<Chat> {
    await this.bookingsService.findByIdForAccount(bookingId, account);
    const existing = await this.getMostRecentChatForBooking(bookingId);
    if (existing) {
      return existing;
    }
    return this.chatRepository.create({ accountId: account.id, bookingId });
  }

  // ── AllRounder chat methods ────────────────────────────────────────────────

  async findOrCreateAllRounderChat(accountId: number): Promise<Chat> {
    const existing = await this.chatRepository.findOne({
      where: { accountId, chatType: 'allrounder' },
      order: [['createdAt', 'DESC']],
    });
    if (existing) return existing;
    return this.chatRepository.create({ accountId, chatType: 'allrounder' });
  }

  async createAllRounderChat(accountId: number): Promise<Chat> {
    return this.chatRepository.create({ accountId, chatType: 'allrounder' });
  }

  async listAllRounderChats(accountId: number): Promise<{ id: number; createdAt: Date; preview: string }[]> {
    const chats = await this.chatRepository.findAll({
      where: { accountId, chatType: 'allrounder' },
      order: [['createdAt', 'DESC']],
      limit: 20,
    });
    const result: { id: number; createdAt: Date; preview: string }[] = [];
    for (const chat of chats) {
      const messages = await this.messagesService.findRecentByChatId(chat.id, 1);
      const firstUserMsg = messages.find((m: any) => m.role === 'user');
      result.push({ id: chat.id, createdAt: chat.createdAt as Date, preview: firstUserMsg?.content?.slice(0, 60) || 'New chat' });
    }
    return result;
  }

  async saveAllRounderMessage(chatId: number, role: MessageRole, content: string, toolCalls?: ToolCallRecord[]) {
    return this.messagesService.create(chatId, role, content, toolCalls);
  }

  async getAllRounderMessages(chatId: number, limit = 50) {
    const msgs = await this.messagesService.findRecentByChatId(chatId, limit);
    return msgs.reverse();
  }

  buildAllRounderContextString(messages: any[]): string {
    if (!messages.length) return '(No messages yet)';
    let ctx = '';
    for (const msg of messages) {
      const label = msg.role === 'user' ? 'User' : 'Assistant';
      ctx += `${label}: ${msg.content}\n\n`;
      if (msg.toolCalls?.length) {
        for (const tc of msg.toolCalls) {
          if (tc.output !== undefined) ctx += `[Tool result - ${tc.toolName}]: ${JSON.stringify(tc.output)}\n\n`;
        }
      }
    }
    return ctx;
  }

  // ── End AllRounder methods ─────────────────────────────────────────────────

  async updateLanguageCode(chatId: number, languageCode: string | null): Promise<Chat> {
    const chat = await this.chatRepository.findByPk(chatId);
    if (!chat) {
      throw new Error(`Chat not found for id: ${chatId}`);
    }
    chat.languageCode = languageCode;
    await chat.save();
    return chat;
  }
}
