import { Injectable } from '@nestjs/common';
import { MessagesService } from '../messages/messages.service';
import { CacheService } from '../common/cache/cache.service';
import { LoggerService } from '../common/logger.service';
import { Message, ToolCallRecord } from '../messages/message.model';

const CACHE_KEY_PREFIX = 'chat_context:';
const CONTEXT_REBUILD_INTERVAL = 20;
const CACHE_TTL_MINUTES = 3;

@Injectable()
export class ChatContextService {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly cacheService: CacheService,
    private readonly logger: LoggerService,
  ) {}

  async buildChatContext(chatId: number): Promise<{ context: string; lastMessageCount: number }> {
    const key = CACHE_KEY_PREFIX + String(chatId);
    const cached = this.cacheService.get<{ context: string; lastMessageCount: number }>(key);
    if (cached) {
      return cached;
    }
    return this.rebuildCache(chatId);
  }

  async rebuildCache(chatId: number): Promise<{ context: string; lastMessageCount: number }> {
    const key = CACHE_KEY_PREFIX + String(chatId);
    let messages: Message[] = [];
    try {
      messages = await this.messagesService.findLastByChatId(chatId, CONTEXT_REBUILD_INTERVAL);
    } catch (e) {
      this.logger.error(e);
    }

    const currentMessageCount = await this.messagesService.countByChatId(chatId);
    let formatted = '';
    for (const msg of messages) {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      formatted += `${role}: ${msg.content}\n\n`;
      if (msg.toolCalls?.length) {
        formatted += this.formatToolCalls(msg.toolCalls);
      }
    }
    const context = formatted || '(No messages yet)';
    const result = { context, lastMessageCount: currentMessageCount };
    this.cacheService.set(key, result, CACHE_TTL_MINUTES);
    return result;
  }

  private formatToolCalls(toolCalls: ToolCallRecord[]): string {
    let result = '';
    for (const toolCall of toolCalls) {
      result += `[Tool: ${toolCall.toolName}] Input: ${JSON.stringify(toolCall.input)}`;
      if (toolCall.output !== undefined) {
        result += ` Output: ${JSON.stringify(toolCall.output)}`;
      }
      if (toolCall.error) {
        result += ` Error: ${toolCall.error}`;
      }
      result += '\n\n';
    }
    return result;
  }
}
