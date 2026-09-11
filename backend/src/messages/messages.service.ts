import { Inject, Injectable } from '@nestjs/common';
import { Op } from 'sequelize';
import { MESSAGES_REPOSITORY } from './messages.repository';
import { Message, MessageRole, ToolCallRecord } from './message.model';

@Injectable()
export class MessagesService {
  constructor(@Inject(MESSAGES_REPOSITORY) private readonly messageRepository: typeof Message) {}

  async findRecentByChatId(chatId: number, limit: number = 50): Promise<Message[]> {
    const rows = await this.messageRepository.findAll({
      where: { chatId },
      order: [['createdAt', 'desc']],
      limit,
    });
    return rows.reverse();
  }

  /**
   * Messages across several chats in one query, chronological. Lets a caller
   * summarise a page of chats without a query per chat.
   */
  async findByChatIds(chatIds: number[]): Promise<Message[]> {
    if (chatIds.length === 0) {
      return [];
    }
    return this.messageRepository.findAll({
      where: { chatId: { [Op.in]: chatIds } },
      order: [['id', 'asc']],
    });
  }

  async create(chatId: number, role: MessageRole, content: string, toolCalls?: ToolCallRecord[]): Promise<Message> {
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

  // Messages in chat with id > afterId, ASC chronological. For summarizer to fetch
  // unsummarized history beyond the last summary's range_end.
  async findByChatIdAfterId(chatId: number, afterId: number): Promise<Message[]> {
    return this.messageRepository.findAll({
      where: { chatId, id: { [Op.gt]: afterId } },
      order: [['id', 'asc']],
    });
  }
}
