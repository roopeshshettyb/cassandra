import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { HumanMessage } from '@langchain/core/messages';
import { encode } from 'gpt-tokenizer';
import { ChatSummary } from './chat-summary.model';
import { CHAT_SUMMARY_REPOSITORY } from './chat-summary.repository';
import { MessagesService } from '../messages/messages.service';
import { LoggerService } from '../common/logger.service';
import { ConstantsService } from '../common/constants/constants.service';
import { CostsService } from '../costs/costs.service';
import { CostType } from '../costs/costs.model';
import { LangGraphService } from '../langgraph/langgraph.service';
import { LlmEvalService } from '../llm-eval/llm-eval.service';
import { MessageFormatter } from '../messages/message-formatter';
import { buildSummaryPrompt } from './summary-prompt.builder';

@Injectable()
export class ChatSummaryService {
  constructor(
    @Inject(CHAT_SUMMARY_REPOSITORY) private readonly summaryRepository: typeof ChatSummary,
    private readonly messagesService: MessagesService,
    private readonly constantsService: ConstantsService,
    private readonly costsService: CostsService,
    @Inject(forwardRef(() => LangGraphService)) private readonly langGraphService: LangGraphService,
    @Inject(forwardRef(() => LlmEvalService)) private readonly llmEvalService: LlmEvalService,
    private readonly logger: LoggerService,
  ) {}

  async getSummary(chatId: number): Promise<ChatSummary | null> {
    return this.summaryRepository.findOne({
      where: { chatId },
      order: [['messageIdEnd', 'desc']],
    });
  }

  // Executes the summarization. The decision of *whether* to summarize is made
  // upstream in ChatContextService from cached token counts (no DB calls); this
  // runs only when that gate has already fired, so it can read freely.
  async maybeSummarize(chatId: number): Promise<void> {
    const cfg = this.constantsService.private.LLM.CONTEXT_SUMMARY;
    if (!cfg.ENABLED) return;
    try {
      const existing = await this.getSummary(chatId);

      const unsummarized = existing
        ? await this.messagesService.findByChatIdAfterId(chatId, existing.messageIdEnd)
        : await this.messagesService.findRecentByChatId(chatId, await this.messagesService.countByChatId(chatId));

      if (unsummarized.length <= cfg.RAW_TAIL_COUNT) return;

      const toFold = unsummarized.slice(0, unsummarized.length - cfg.RAW_TAIL_COUNT);
      if (!toFold.length) return;

      const previousSummary = existing?.summary ?? null;
      const prompt = buildSummaryPrompt(cfg.INSTRUCTIONS, previousSummary, toFold, cfg.TARGET_WORDS);
      const newSummary = await this.callSummaryModel(prompt, chatId);
      if (!newSummary) return;

      const messageIdEnd = toFold[toFold.length - 1].id;
      const tokenEstimate = this.estimateTokens(newSummary);

      if (existing) {
        existing.summary = newSummary;
        existing.messageIdEnd = messageIdEnd;
        existing.tokenEstimate = tokenEstimate;
        await existing.save();
      } else {
        await this.summaryRepository.create({ chatId, summary: newSummary, messageIdEnd, tokenEstimate });
      }

      // Fire-and-forget: grade the summary's accuracy (LLM-as-judge).
      this.llmEvalService
        .maybeEvaluateSummary({
          chatId,
          messageId: messageIdEnd,
          previousSummary,
          foldedMessages: MessageFormatter.formatMessages(toFold),
          newSummary,
          hotelId: null,
        })
        .catch((err) => this.logger.error(err));
    } catch (err) {
      this.logger.error({ error: err, serviceName: 'ChatSummary', actionName: `maybeSummarize chatId=${chatId}` });
    }
  }

  private async callSummaryModel(prompt: string, chatId: number): Promise<string | null> {
    const llm = this.constantsService.private.LLM;
    try {
      const result: any = await this.langGraphService
        .createModel(llm.CONTEXT_SUMMARY.TEMPERATURE, llm.SUMMARY_MODEL)
        .invoke([new HumanMessage(prompt)]);
      const text = typeof result.content === 'string' ? result.content : String(result.content);
      const usage: any = result.usage_metadata ?? result.response_metadata?.tokenUsage ?? {};
      const promptTokens = usage.input_tokens ?? usage.promptTokens ?? this.estimateTokens(prompt);
      const completionTokens = usage.output_tokens ?? usage.completionTokens ?? this.estimateTokens(text);
      this.costsService.recordLlmCost({
        type: CostType.LLM_SUMMARY,
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

  estimateTokens(text: string): number {
    if (!text) return 0;
    try { return encode(text).length; } catch { return Math.ceil(text.length / 4); }
  }
}
