import { Inject, Injectable } from '@nestjs/common';
import { COSTS_REPOSITORY } from './costs.repository';
import { Cost, CostType } from './costs.model';
import { ConstantsService } from '../common/constants/constants.service';
import { AudioUsage, PricingConfig, TokenUsage, calculateTextCost, calculateVoiceCost } from './costs.pricing';

export interface ChatCostMeta {
  model?: string;
  provider?: string;
  requestId?: string;
  tokensPrompt?: number;
  tokensCompletion?: number;
  tokensTotal?: number;
  pricingVersion?: string;
  // Allow any extra fields for future flexibility.
  [key: string]: unknown;
}

export interface VoiceCostMeta {
  model?: string;
  provider?: string;
  requestId?: string;
  tokensPrompt?: number;
  tokensOutput?: number;
  tokensTotal?: number;
  audioInputMs?: number;
  audioOutputMs?: number;
  pricingVersion?: string;
  [key: string]: unknown;
}

@Injectable()
export class CostsService {
  constructor(
    @Inject(COSTS_REPOSITORY) private readonly costsRepository: typeof Cost,
    private readonly constantsService: ConstantsService,
  ) {}

  async recordCost(params: {
    type: CostType;
    amount: string;
    currency: string;
    meta?: ChatCostMeta | VoiceCostMeta;
    bookingId?: number | null;
    hotelId?: number | null;
    accountId?: number | null;
    role?: string | null;
    chatId?: number | null;
    messageId?: number | null;
  }) {
    try {
      await this.costsRepository.create(params as Partial<Cost>);
    } catch {}
  }

  async recordLlmCost(params: {
    type: CostType;
    usage: TokenUsage;
    audio?: AudioUsage;
    bookingId: number;
    hotelId: number | null;
    accountId: number;
    role: string;
    chatId: number;
    messageId: number | null;
  }) {
    const llm = this.constantsService.private.LLM;
    const pricingConfig: PricingConfig = {
      currency: llm.CURRENCY,
      textInputPricePer1K: llm.TEXT_INPUT_PRICE_PER_1K,
      textOutputPricePer1K: llm.TEXT_OUTPUT_PRICE_PER_1K,
      voiceInputPricePerMinute: llm.VOICE_INPUT_PER_MINUTE,
      voiceOutputPricePerMinute: llm.VOICE_OUTPUT_PER_MINUTE,
    };

    let pricing;
    if (params.type === CostType.LLM_CHAT) {
      pricing = calculateTextCost({
        model: llm.TEXT_MODEL,
        provider: llm.PROVIDER,
        usage: params.usage,
        config: pricingConfig,
      });
    } else {
      pricing = calculateVoiceCost({
        model: llm.VOICE_MODEL,
        provider: llm.PROVIDER,
        usage: params.usage,
        audio: params.audio,
        config: pricingConfig,
      });
    }

    this.recordCost({
      type: params.type,
      amount: pricing.amount,
      currency: pricing.currency,
      meta: {
        ...pricing.meta,
        chatId: params.chatId,
      },
      bookingId: params.bookingId,
      hotelId: params.hotelId,
      accountId: params.accountId,
      role: params.role,
      chatId: params.chatId,
      messageId: params.messageId,
    });
  }

  async findByBookingId(bookingId: number) {
    const costs = await this.costsRepository.findAll({
      where: { bookingId },
      order: [['createdAt', 'DESC']],
    });

    return {
      success: true,
      message: null,
      data: costs,
    };
  }

  async findByHotelId(hotelId: number) {
    const costs = await this.costsRepository.findAll({
      where: { hotelId },
      order: [['createdAt', 'DESC']],
    });

    return {
      success: true,
      message: null,
      data: costs,
    };
  }
}
