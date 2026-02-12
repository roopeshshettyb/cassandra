import { Inject, Injectable } from '@nestjs/common';
import { MESSAGES_REPOSITORY } from './messages.repository';
import { Message, MessageRole, ToolCallRecord } from './message.model';

@Injectable()
export class MessagesService {
  constructor(
    @Inject(MESSAGES_REPOSITORY) private readonly messageRepository: typeof Message,
  ) { }

  private demoMessages: Message[] = [];

  async findRecentByChatId(chatId: number, limit: number = 50): Promise<Message[]> {
    console.log(`findRecentByChatId: chatId=${chatId} (${typeof chatId})`);
    if (chatId == 999) {
      return [...this.demoMessages]
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .slice(-limit);
    }
    return this.messageRepository.findAll({
      where: { chatId },
      order: [['createdAt', 'ASC']],
      limit,
    });
  }

  /** Returns the last N messages in chronological order (for context building). */
  async findLastByChatId(chatId: number, limit: number): Promise<Message[]> {
    console.log(`findLastByChatId: chatId=${chatId} (${typeof chatId})`);
    if (chatId == 999) {
      const messages = [...this.demoMessages]
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .slice(-limit);
      return messages;
    }
    const rows = await this.messageRepository.findAll({
      where: { chatId },
      order: [['createdAt', 'DESC']],
      limit,
    });
    return rows.reverse();
  }

  async create(
    chatId: number,
    role: MessageRole,
    content: string,
    toolCalls?: ToolCallRecord[],
  ): Promise<Message> {
    console.log(`create: chatId=${chatId} (${typeof chatId})`);
    if (chatId == 999) {
      const msg = {
        id: this.demoMessages.length + 1,
        chatId,
        role,
        content,
        toolCalls: toolCalls ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;
      this.demoMessages.push(msg);
      return msg;
    }
    return this.messageRepository.create({
      chatId,
      role,
      content,
      toolCalls: toolCalls ?? null,
    });
  }

  async countByChatId(chatId: number): Promise<number> {
    if (chatId == 999) {
      return this.demoMessages.length;
    }
    return this.messageRepository.count({ where: { chatId } });
  }
}
