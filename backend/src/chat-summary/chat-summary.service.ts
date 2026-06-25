import { Inject, Injectable } from '@nestjs/common';
import { Op } from 'sequelize';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { encode } from 'gpt-tokenizer';
import { ChatSummary } from './chat-summary.model';
import { CHAT_SUMMARY_REPOSITORY } from './chat-summary.repository';
import { MessagesService } from '../messages/messages.service';
import { Message } from '../messages/message.model';
import { LoggerService } from '../common/logger.service';
import { ConstantsService } from '../common/constants/constants.service';
import { CostsService } from '../costs/costs.service';
import { CostType } from '../costs/costs.model';
import { buildTier1Prompt, buildTier2Prompt } from './summary-prompt.builder';

interface ActiveSummaries {
  tier2: string | null;
  tier1: Array<{ id: number; summary: string; messageIdEnd: number }>;
  highestSummarizedMessageId: number;
}

@Injectable()
export class ChatSummaryService {
  constructor(
    @Inject(CHAT_SUMMARY_REPOSITORY) private readonly summaryRepository: typeof ChatSummary,
    private readonly messagesService: MessagesService,
    private readonly constantsService: ConstantsService,
    private readonly costsService: CostsService,
    private readonly logger: LoggerService,
  ) {}

  // All active (non-archived) summaries for a chat, ordered chronologically.
  async getActiveSummaries(chatId: number): Promise<ActiveSummaries> {
    const rows = await this.summaryRepository.findAll({
      where: { chatId, archived: false },
      order: [['messageIdEnd', 'asc']],
    });
    let tier2: string | null = null;
    const tier1: Array<{ id: number; summary: string; messageIdEnd: number }> = [];
    let highest = 0;
    for (const r of rows) {
      if (r.tier === 2) tier2 = r.summary;
      else tier1.push({ id: r.id, summary: r.summary, messageIdEnd: r.messageIdEnd });
      if (r.messageIdEnd > highest) highest = r.messageIdEnd;
    }
    return { tier2, tier1, highestSummarizedMessageId: highest };
  }

  // Idempotent. Called by ChatContextService before assembling context.
  // No-op when feature flag off, when nothing to summarize, or when below threshold.
  async maybeSummarize(chatId: number): Promise<void> {
    const cfg = this.constantsService.private.LLM.CONTEXT_SUMMARY;
    if (!cfg.ENABLED) return;
    try {
      const active = await this.getActiveSummaries(chatId);
      const pending = await this.messagesService.findByChatIdAfterId(chatId, active.highestSummarizedMessageId);
      if (pending.length <= cfg.RAW_TAIL_COUNT + cfg.CHUNK_SIZE) return;

      // Candidate chunk = oldest CHUNK_SIZE messages of the pending block, leaving
      // RAW_TAIL_COUNT untouched at the end so the agent always sees recent turns verbatim.
      const candidate = pending.slice(0, pending.length - cfg.RAW_TAIL_COUNT).slice(0, cfg.CHUNK_SIZE);
      const candidateTokens = this.estimateTokens(candidate.map((m) => m.content ?? '').join('\n'));
      if (candidateTokens < cfg.TRIGGER_TOKENS) return;

      await this.createTier1Chunk(chatId, candidate);

      // Promote when too many tier-1 rows accumulated.
      const fresh = await this.getActiveSummaries(chatId);
      if (fresh.tier1.length > cfg.TIER1_MAX_COUNT) {
        await this.promoteToTier2(chatId);
      }
    } catch (err) {
      this.logger.error({ error: err, serviceName: 'ChatSummary', actionName: `maybeSummarize chatId=${chatId}` });
    }
  }

  private async createTier1Chunk(chatId: number, messages: Message[]): Promise<void> {
    if (!messages.length) return;
    const cfg = this.constantsService.private.LLM.CONTEXT_SUMMARY;
    const prompt = buildTier1Prompt(cfg.TIER1_INSTRUCTIONS, messages, cfg.TIER1_TARGET_WORDS);
    const summary = await this.callSummaryModel(prompt, chatId);
    if (!summary) return;
    await this.summaryRepository.create({
      chatId,
      tier: 1,
      summary,
      messageIdStart: messages[0].id,
      messageIdEnd: messages[messages.length - 1].id,
      tokenEstimate: this.estimateTokens(summary),
      archived: false,
    });
  }

  private async promoteToTier2(chatId: number): Promise<void> {
    const cfg = this.constantsService.private.LLM.CONTEXT_SUMMARY;
    const rows = await this.summaryRepository.findAll({
      where: { chatId, archived: false },
      order: [['messageIdEnd', 'asc']],
    });
    const existingTier2Row = rows.find((r) => r.tier === 2) ?? null;
    const tier1Rows = rows.filter((r) => r.tier === 1);
    if (!tier1Rows.length) return;
    const prompt = buildTier2Prompt(cfg.TIER2_INSTRUCTIONS, existingTier2Row?.summary ?? null, tier1Rows.map((r) => r.summary), cfg.TIER2_TARGET_WORDS);
    const merged = await this.callSummaryModel(prompt, chatId);
    if (!merged) return;

    const messageIdStart = existingTier2Row?.messageIdStart ?? tier1Rows[0].messageIdStart;
    const messageIdEnd = tier1Rows[tier1Rows.length - 1].messageIdEnd;

    if (existingTier2Row) {
      existingTier2Row.summary = merged;
      existingTier2Row.messageIdEnd = messageIdEnd;
      existingTier2Row.tokenEstimate = this.estimateTokens(merged);
      await existingTier2Row.save();
    } else {
      await this.summaryRepository.create({
        chatId,
        tier: 2,
        summary: merged,
        messageIdStart,
        messageIdEnd,
        tokenEstimate: this.estimateTokens(merged),
        archived: false,
      });
    }
    await this.summaryRepository.update(
      { archived: true },
      { where: { chatId, tier: 1, id: { [Op.in]: tier1Rows.map((r) => r.id) } } },
    );
  }

  private async callSummaryModel(prompt: string, chatId: number): Promise<string | null> {
    const llm = this.constantsService.private.LLM;
    const model = new ChatOpenAI({
      modelName: llm.SUMMARY_MODEL,
      apiKey: llm.OPENROUTER.API_KEY,
      temperature: 0.2,
      configuration: { baseURL: llm.OPENROUTER.BASE_URL },
    });
    try {
      const result: any = await model.invoke([new HumanMessage(prompt)]);
      const text = typeof result.content === 'string' ? result.content : String(result.content);
      const usage: any = result.usage_metadata ?? result.response_metadata?.tokenUsage ?? {};
      const promptTokens = usage.input_tokens ?? usage.promptTokens ?? this.estimateTokens(prompt);
      const completionTokens = usage.output_tokens ?? usage.completionTokens ?? this.estimateTokens(text);
      // Tag as LLM_CHAT subtype=summary in meta — keeps existing enum_costs_type unchanged
      // (RDS-managed, can't add enum values without owner perms).
      this.costsService.recordLlmCost({
        type: CostType.LLM_CHAT,
        usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
        bookingId: null,
        hotelId: null,
        accountId: null,
        role: null,
        chatId,
        messageId: null,
      });
      return text.trim();
    } catch (err) {
      this.logger.error({ error: err, serviceName: 'ChatSummary', actionName: `summary model call chatId=${chatId}` });
      return null;
    }
  }

  // Accurate token count via gpt-tokenizer (cl100k_base, matches gpt-4o family).
  private estimateTokens(text: string): number {
    if (!text) return 0;
    try { return encode(text).length; } catch { return Math.ceil(text.length / 4); }
  }
}
