import { Inject, Injectable } from '@nestjs/common';
import { MESSAGES_REPOSITORY } from './messages.repository';
import { Message, MessageRole, ToolCallRecord } from './message.model';

@Injectable()
export class MessagesService {
  constructor(
    @Inject(MESSAGES_REPOSITORY) private readonly messageRepository: typeof Message,
  ) {}

  async findRecentByChatId(chatId: number, limit: number = 50): Promise<Message[]> {
    return this.messageRepository.findAll({
      where: { chatId },
      order: [['createdAt', 'ASC']],
      limit,
    });
  }

  /** Returns the last N messages in chronological order (for context building). */
  async findLastByChatId(chatId: number, limit: number): Promise<Message[]> {
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
    return this.messageRepository.create({
      chatId,
      role,
      content,
      toolCalls: toolCalls ?? null,
    });
  }

  async countByChatId(chatId: number): Promise<number> {
    return this.messageRepository.count({ where: { chatId } });
  }
}
