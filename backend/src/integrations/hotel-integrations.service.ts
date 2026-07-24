import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { HOTEL_INTEGRATIONS_REPOSITORY } from './hotel-integrations.repository';
import { HotelIntegration, IntegrationStatus } from './hotel-integrations.model';
import { Account } from '../accounts/accounts.model';
import { HotelsService } from '../hotels/hotels.service';
import { ConstantsService } from '../common/constants/constants.service';

export interface WebhookUrls {
  bookings: string;
  requests: string;
}

@Injectable()
export class HotelIntegrationsService {
  constructor(
    @Inject(HOTEL_INTEGRATIONS_REPOSITORY) private readonly integrationsRepository: typeof HotelIntegration,
    private readonly hotelsService: HotelsService,
    private readonly constantsService: ConstantsService,
  ) {}

  private buildWebhookUrls(): WebhookUrls {
    const config = this.constantsService.private;
    return {
      bookings: `${config.BACKEND_URL}${config.INTEGRATIONS.V1_BOOKINGS_PATH}`,
      requests: `${config.BACKEND_URL}${config.INTEGRATIONS.V1_REQUESTS_PATH}`,
    };
  }

  private generatePlaintextToken(): string {
    return randomBytes(this.constantsService.private.INTEGRATIONS.TOKEN_BYTE_LENGTH).toString('hex');
  }

  private hashToken(token: string): string {
    return createHash(this.constantsService.private.INTEGRATIONS.TOKEN_HASH_ALGORITHM).update(token).digest('hex');
  }

  async getMetadataForHotel(hotelId: number, currentAccount: Account) {
    await this.hotelsService.ensureCanManageHotelSettings(hotelId, currentAccount);
    const integration = await this.integrationsRepository.findOne({ where: { hotelId } });

    return {
      success: true,
      message: null,
      data: {
        status: integration?.status ?? null,
        tokenPrefix: integration?.tokenPrefix ?? null,
        createdAt: integration?.createdAt ?? null,
        webhookUrls: this.buildWebhookUrls(),
      },
    };
  }

  // Generate and rotate are the same operation: the row is unique per hotel, so
  // this always overwrites whatever token currently exists (or creates the row on
  // first use) and returns the plaintext exactly once.
  async generateOrRotateToken(hotelId: number, currentAccount: Account) {
    await this.hotelsService.ensureCanManageHotelSettings(hotelId, currentAccount);

    const plaintextToken = this.generatePlaintextToken();
    const tokenHash = this.hashToken(plaintextToken);
    const tokenPrefix = plaintextToken.slice(0, this.constantsService.private.INTEGRATIONS.TOKEN_PREFIX_LENGTH);

    let integration = await this.integrationsRepository.findOne({ where: { hotelId } });
    const isRotate = !!integration;
    if (integration) {
      integration.tokenHash = tokenHash;
      integration.tokenPrefix = tokenPrefix;
      integration.status = IntegrationStatus.ACTIVE;
      integration.createdByAccountId = currentAccount.id;
      await integration.save();
    } else {
      integration = await this.integrationsRepository.create({
        hotelId,
        tokenHash,
        tokenPrefix,
        status: IntegrationStatus.ACTIVE,
        createdByAccountId: currentAccount.id,
      });
    }

    const config = this.constantsService.private.INTEGRATIONS;
    return {
      success: true,
      message: isRotate ? config.MSG_TOKEN_ROTATED : config.MSG_TOKEN_GENERATED,
      data: {
        token: plaintextToken,
        status: integration.status,
        tokenPrefix: integration.tokenPrefix,
        createdAt: integration.createdAt,
        webhookUrls: this.buildWebhookUrls(),
      },
    };
  }

  async revokeToken(hotelId: number, currentAccount: Account) {
    await this.hotelsService.ensureCanManageHotelSettings(hotelId, currentAccount);

    const integration = await this.integrationsRepository.findOne({ where: { hotelId } });
    if (!integration) {
      throw new NotFoundException();
    }
    integration.status = IntegrationStatus.REVOKED;
    await integration.save();

    return {
      success: true,
      message: this.constantsService.private.INTEGRATIONS.MSG_TOKEN_REVOKED,
      data: null,
    };
  }

  // Used only by IntegrationAuthGuard. Never logged or returned to any client.
  async resolveHotelIdFromToken(plaintextToken: string): Promise<number | null> {
    const tokenHash = this.hashToken(plaintextToken);
    const integration = await this.integrationsRepository.findOne({
      where: { tokenHash, status: IntegrationStatus.ACTIVE },
    });
    return integration?.hotelId ?? null;
  }
}
