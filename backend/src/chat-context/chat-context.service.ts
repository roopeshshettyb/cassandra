import { Injectable } from '@nestjs/common';
import { MessagesService } from '../messages/messages.service';
import { CacheService } from '../common/cache/cache.service';
import { LoggerService } from '../common/logger.service';
import { ConstantsService } from '../common/constants/constants.service';
import { ChatSummaryService } from '../chat-summary/chat-summary.service';
import { Message } from '../messages/message.model';
import { MessageFormatter } from '../messages/message-formatter';

const CACHE_KEY_PREFIX = 'chat_context:';
const CACHE_TTL_MINUTES = 3;

@Injectable()
export class ChatContextService {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly cacheService: CacheService,
    private readonly logger: LoggerService,
    private readonly constantsService: ConstantsService,
    private readonly chatSummaryService: ChatSummaryService,
  ) {}

  async buildChatContext(chatId: number): Promise<{ context: string; lastMessageCount: number }> {
    const key = CACHE_KEY_PREFIX + String(chatId);
    const cached = this.cacheService.get<{ context: string; lastMessageCount: number }>(key);
    if (cached) {
      return cached;
    }
    return this.rebuildCache(chatId);
  }

  // Read path (called on cache miss). Never blocks on summarization — purely fetches
  // existing summaries + raw tail. Summarization runs only via rebuildCacheAndSummarize
  // (post-response path).
  async rebuildCache(chatId: number): Promise<{ context: string; lastMessageCount: number }> {
    const key = CACHE_KEY_PREFIX + String(chatId);
    const cfg = this.constantsService.private.LLM.CONTEXT_SUMMARY;

    let summaries: Awaited<ReturnType<ChatSummaryService['getActiveSummaries']>> = {
      tier2: null, tier1: [], highestSummarizedMessageId: 0,
    };
    let recent: Message[] = [];
    try {
      if (cfg.ENABLED) {
        summaries = await this.chatSummaryService.getActiveSummaries(chatId);
        // Pull only the unsummarized tail so we don't duplicate content already captured in summaries.
        const pending = await this.messagesService.findByChatIdAfterId(chatId, summaries.highestSummarizedMessageId);
        recent = pending.slice(-cfg.RAW_TAIL_COUNT);
      } else {
        recent = await this.messagesService.findRecentByChatId(chatId, cfg.RAW_TAIL_COUNT);
      }
    } catch (e) {
      this.logger.error(e);
    }

    const currentMessageCount = await this.messagesService.countByChatId(chatId);
    const context = this.assembleContext(summaries.tier2, summaries.tier1.map((s) => s.summary), recent);
    const result = { context, lastMessageCount: currentMessageCount };
    this.cacheService.set(key, result, CACHE_TTL_MINUTES);
    return result;
  }

  // Write path (called after assistant message is saved). Runs summarization first so
  // any new tier-1/tier-2 rows land before we rebuild + cache. The user has already
  // received the assistant response by the time this is invoked, so the extra latency
  // (typically ~2-4s when the threshold trips) is not user-visible.
  async rebuildCacheAndSummarize(chatId: number): Promise<{ context: string; lastMessageCount: number }> {
    await this.chatSummaryService.maybeSummarize(chatId);
    return this.rebuildCache(chatId);
  }

  private assembleContext(tier2: string | null, tier1: string[], recent: Message[]): string {
    const parts: string[] = [];
    if (tier2) parts.push(`[Earlier conversation summary]\n${tier2}`);
    if (tier1.length) parts.push(`[Recent conversation summary]\n${tier1.join('\n\n')}`);
    if (recent.length) parts.push(`[Recent messages]\n${MessageFormatter.formatMessages(recent)}`);
    return parts.length ? parts.join('\n\n---\n\n') : '(No messages yet)';
  }
}
