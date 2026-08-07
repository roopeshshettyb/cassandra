import { Injectable } from '@nestjs/common';
import { MessagesService } from '../messages/messages.service';
import { CacheService } from '../common/cache/cache.service';
import { LoggerService } from '../common/logger.service';
import { ConstantsService } from '../common/constants/constants.service';
import { ChatSummaryService } from '../chat-summary/chat-summary.service';
import { Message } from '../messages/message.model';
import { MessageFormatter } from '../messages/message-formatter';

// Cached per chat. `recent` + `summary` let us reassemble the context string and
// `pendingTokens` (summary tokens + tokens of messages not yet folded) lets us
// decide whether to summarize without any DB reads on the hot path.
interface ChatContextCache {
  context: string;
  lastMessageCount: number;
  summary: string | null;
  recent: Message[];
  pendingTokens: number;
}

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
    const cfg = this.constantsService.private.LLM.CONTEXT_SUMMARY;
    const key = cfg.CACHE_KEY_PREFIX + String(chatId);
    const cached = this.cacheService.get<ChatContextCache>(key);
    if (cached) return cached;
    return this.rebuildCache(chatId);
  }

  // When `newMessages` is given (post-turn), updates the cache in place from the
  // previous summary + recent tail — no DB calls — and decides whether to fold a
  // summary. Without it (cache miss / read path), loads fresh from the DB.
  async rebuildCache(chatId: number, newMessages?: Message[]): Promise<ChatContextCache> {
    const cfg = this.constantsService.private.LLM.CONTEXT_SUMMARY;
    const key = cfg.CACHE_KEY_PREFIX + String(chatId);
    const cached = this.cacheService.get<ChatContextCache>(key);

    let entry: ChatContextCache;
    if (cached && newMessages && newMessages.length) {
      const recent = [...cached.recent, ...newMessages].slice(-cfg.RAW_TAIL_COUNT);
      const addedTokens = this.chatSummaryService.estimateTokens(MessageFormatter.formatMessages(newMessages));
      entry = {
        summary: cached.summary,
        recent,
        pendingTokens: cached.pendingTokens + addedTokens,
        lastMessageCount: cached.lastMessageCount + newMessages.length,
        context: this.assembleContext(cached.summary, recent),
      };
    } else {
      entry = await this.loadFromDb(chatId);
    }

    this.cacheService.set(key, entry, cfg.CACHE_TTL_MINUTES);
    if (newMessages !== undefined) this.triggerSummarize(chatId, entry.pendingTokens);
    return entry;
  }

  private async loadFromDb(chatId: number): Promise<ChatContextCache> {
    const cfg = this.constantsService.private.LLM.CONTEXT_SUMMARY;

    let summary: string | null = null;
    let summaryEndId = 0;
    let recent: Message[] = [];
    let pendingTokens = 0;
    try {
      if (cfg.ENABLED) {
        const row = await this.chatSummaryService.getSummary(chatId);
        summary = row?.summary ?? null;
        summaryEndId = row?.messageIdEnd ?? 0;
        const unsummarized = await this.messagesService.findByChatIdAfterId(chatId, summaryEndId);
        pendingTokens = this.chatSummaryService.estimateTokens(summary ?? '') +
          this.chatSummaryService.estimateTokens(MessageFormatter.formatMessages(unsummarized));
      }
      recent = await this.messagesService.findRecentByChatId(chatId, cfg.RAW_TAIL_COUNT);
    } catch (e) {
      this.logger.error(e);
    }

    const currentMessageCount = await this.messagesService.countByChatId(chatId);
    return {
      summary,
      recent,
      pendingTokens,
      lastMessageCount: currentMessageCount,
      context: this.assembleContext(summary, recent),
    };
  }

  private triggerSummarize(chatId: number, pendingTokens: number): void {
    const cfg = this.constantsService.private.LLM.CONTEXT_SUMMARY;
    if (!cfg.ENABLED || pendingTokens < cfg.TRIGGER_TOKENS) return;
    this.chatSummaryService.maybeSummarize(chatId)
      .then(() => this.rebuildCache(chatId))
      .catch((err) => this.logger.error(err));
  }

  private assembleContext(summary: string | null, recent: Message[]): string {
    const parts: string[] = [];
    if (summary) parts.push(`[Conversation summary]\n${summary}`);
    if (recent.length) parts.push(`[Recent messages]\n${MessageFormatter.formatMessages(recent)}`);
    return parts.length ? parts.join('\n\n---\n\n') : this.constantsService.private.LLM.CONTEXT_SUMMARY.EMPTY_CONTEXT;
  }
}
