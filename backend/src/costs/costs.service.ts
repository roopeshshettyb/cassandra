import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { COSTS_REPOSITORY } from './costs.repository';
import { Cost, CostType } from './costs.model';
import { ConstantsService } from '../common/constants/constants.service';
import { PricingConfig, TokenUsage, calculateTextCost, calculateRealtimeVoiceCost, calculateDurationCost } from './costs.pricing';
import { Account, AccountRole } from '../accounts/accounts.model';
import { Hotel } from '../hotels/hotels.model';
import { Booking } from '../bookings/bookings.model';
import { Op } from 'sequelize';
import { HotelsService } from '../hotels/hotels.service';

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
    @Inject(forwardRef(() => HotelsService)) private readonly hotelsService: HotelsService,
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

  // accountId/role/chatId are nullable: summary and extraction-flow evals record
  // spend with no chat or account context (columns are nullable in the DB).
  //
  // Pricing is selected by which model actually ran, not by `type` alone: LLM_VOICE
  // covers BOTH the OpenAI Realtime pipeline (real audio+text tokens, priced far
  // above plain chat) AND the "custom" STT+LLM+TTS pipeline's LLM step (a plain
  // TEXT_MODEL completion with no audio tokens at all) — using `type` alone would
  // price the latter's ordinary text tokens at Realtime's audio rates. Presence of
  // the audio usage fields is what actually distinguishes them.
  async recordLlmCost(params: {
    type: CostType;
    usage: TokenUsage;
    bookingId: number | null;
    hotelId: number | null;
    accountId: number | null;
    role: string | null;
    chatId: number | null;
    messageId: number | null;
  }) {
    const llm = this.constantsService.private.LLM;
    const isRealtimeVoice = params.usage.audioPromptTokens !== undefined || params.usage.audioCompletionTokens !== undefined;

    const pricing = isRealtimeVoice
      ? calculateRealtimeVoiceCost({
          model: llm.STT_CONFIG.OPENAI.REALTIME_MODEL,
          provider: 'openai',
          usage: params.usage,
          config: {
            currency: llm.CURRENCY,
            textInputPricePer1K: llm.REALTIME_PRICING.TEXT_INPUT_PRICE_PER_1K,
            textOutputPricePer1K: llm.REALTIME_PRICING.TEXT_OUTPUT_PRICE_PER_1K,
            audioInputPricePer1K: llm.REALTIME_PRICING.AUDIO_INPUT_PRICE_PER_1K,
            audioOutputPricePer1K: llm.REALTIME_PRICING.AUDIO_OUTPUT_PRICE_PER_1K,
            cachedInputPricePer1K: llm.REALTIME_PRICING.CACHED_INPUT_PRICE_PER_1K,
          },
        })
      : calculateTextCost({
          model: params.type === CostType.LLM_SUMMARY ? llm.SUMMARY_MODEL : llm.TEXT_MODEL,
          provider: llm.PROVIDER,
          usage: params.usage,
          config: {
            currency: llm.CURRENCY,
            textInputPricePer1K: params.type === CostType.LLM_SUMMARY ? llm.SUMMARY_INPUT_PRICE_PER_1K : llm.TEXT_INPUT_PRICE_PER_1K,
            textOutputPricePer1K: params.type === CostType.LLM_SUMMARY ? llm.SUMMARY_OUTPUT_PRICE_PER_1K : llm.TEXT_OUTPUT_PRICE_PER_1K,
          } as PricingConfig,
        });

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

  // Deepgram Voice Agent bills by websocket connection time, not tokens — one row
  // per call, recorded at session close (see DeepgramVoiceAgentService).
  async recordVoiceSessionDurationCost(params: {
    durationMs: number;
    bookingId: number | null;
    hotelId: number | null;
    accountId: number | null;
    role: string | null;
    chatId: number | null;
  }) {
    const llm = this.constantsService.private.LLM;
    const pricing = calculateDurationCost({
      model: llm.DEEPGRAM_VOICE_AGENT.LISTEN_MODEL,
      provider: 'deepgram',
      durationMs: params.durationMs,
      config: {
        currency: llm.CURRENCY,
        pricePerMinute: llm.DEEPGRAM_VOICE_AGENT.PRICE_PER_MINUTE,
      },
    });

    this.recordCost({
      type: CostType.LLM_VOICE,
      amount: pricing.amount,
      currency: pricing.currency,
      meta: { ...pricing.meta, chatId: params.chatId },
      bookingId: params.bookingId,
      hotelId: params.hotelId,
      accountId: params.accountId,
      role: params.role,
      chatId: params.chatId,
      messageId: null,
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

  async aggregateCosts(currentAccount: Account) {
    if (currentAccount.role === AccountRole.GUEST) {
      return { success: true, message: null, data: [] };
    }

    const where: any = {};

    if (currentAccount.role === AccountRole.HOTEL_OWNER) {
      const { data: hotels } = await this.hotelsService.findAllForAccount(currentAccount);
      const hotelIds = hotels.map((h) => h.id);
      if (hotelIds.length === 0) {
        return { success: true, message: null, data: [] };
      }
      where.hotelId = { [Op.in]: hotelIds };
    }

    const costs = await this.costsRepository.findAll({
      where,
      include: [
        {
          model: Booking,
          as: 'booking',
          include: [{ model: Account, as: 'guest', attributes: ['id', 'name', 'email'] }],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const aggregated: Record<string, any> = {};

    for (const cost of costs) {
      // Group by booking ID. If no booking ID, skip or group under 'Other'
      const key = cost.bookingId ? `booking-${cost.bookingId}` : `other`;
      
      if (!aggregated[key]) {
        aggregated[key] = {
          id: key,
          bookingId: cost.bookingId,
          guestName: cost.booking?.guest?.name || 'Unknown',
          guestEmail: cost.booking?.guest?.email || 'Unknown',
          totalCost: 0,
          currency: cost.currency,
          breakdown: [],
        };
      }

      // Simple addition assuming same currency or we just sum raw values for now as per plan
      aggregated[key].totalCost += parseFloat(cost.amount);
      aggregated[key].breakdown.push({
        id: cost.id,
        type: cost.type,
        amount: cost.amount,
        createdAt: cost.createdAt,
      });
    }

    return {
      success: true,
      message: null,
      data: Object.values(aggregated),
    };
  }
}
