import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { COSTS_REPOSITORY } from './costs.repository';
import { Cost, CostType } from './costs.model';
import { ConstantsService } from '../common/constants/constants.service';
import { PricingConfig, TokenUsage, calculateTextCost } from './costs.pricing';
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

  async recordLlmCost(params: {
    type: CostType;
    usage: TokenUsage;
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
    };

    const pricing = calculateTextCost({
      model: llm.TEXT_MODEL,
      provider: llm.PROVIDER,
      usage: params.usage,
      config: pricingConfig,
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
