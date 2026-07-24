import { Body, Controller, NotFoundException, Param, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { BookingsService } from '../bookings/bookings.service';
import { RequestsService } from '../requests/requests.service';
import { ConstantsService } from '../common/constants/constants.service';
import { IntegrationAuthGuard } from './integration-auth.guard';
import { CurrentIntegrationHotelId } from './decorators/integration-hotel-id.decorator';
import { UpsertBookingDto, UpsertRequestDto } from './integrations.dto';
import { AdapterRegistry } from './adapters/adapter.registry';

// Inbound PMS webhooks. Guarded by IntegrationAuthGuard only (Bearer integration
// token) — never the session JwtAuthGuard. Path values here must match
// INTEGRATIONS.V1_BOOKINGS_PATH / V1_REQUESTS_PATH in constants.service.ts.
@Controller('integrations')
@UseGuards(IntegrationAuthGuard)
export class IntegrationsWebhookController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly requestsService: RequestsService,
    private readonly constantsService: ConstantsService,
    private readonly adapterRegistry: AdapterRegistry,
  ) {}

  @Post('v1/bookings')
  async upsertBooking(@Body(ValidationPipe) dto: UpsertBookingDto, @CurrentIntegrationHotelId() hotelId: number) {
    const booking = await this.bookingsService.upsertByExternalId(hotelId, dto);
    return { success: true, message: this.constantsService.private.INTEGRATIONS.MSG_BOOKING_UPSERTED, data: booking };
  }

  @Post('v1/requests')
  async upsertRequest(@Body(ValidationPipe) dto: UpsertRequestDto, @CurrentIntegrationHotelId() hotelId: number) {
    const request = await this.requestsService.upsertByExternalId(hotelId, dto);
    return { success: true, message: this.constantsService.private.INTEGRATIONS.MSG_REQUEST_UPSERTED, data: request };
  }

  @Post('providers/:provider/webhooks')
  async providerWebhook(@Param('provider') provider: string, @Body() body: any, @CurrentIntegrationHotelId() hotelId: number) {
    const adapter = this.adapterRegistry.get(provider);
    if (!adapter) {
      throw new NotFoundException(this.constantsService.private.INTEGRATIONS.ERROR_UNKNOWN_PROVIDER);
    }
    adapter.verify(body);
    const items = adapter.parse(body);

    const results: unknown[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type === 'booking') {
        results.push(await this.bookingsService.upsertByExternalId(hotelId, item.payload));
      } else {
        results.push(await this.requestsService.upsertByExternalId(hotelId, item.payload));
      }
    }

    return { success: true, message: null, data: results };
  }
}
