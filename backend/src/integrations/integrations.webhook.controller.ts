import { Body, Controller, HttpStatus, NotFoundException, Param, Post, Res, UseGuards, ValidationPipe } from '@nestjs/common';
import { Response } from 'express';
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

  // 201 on insert, 200 on update — an upsert that always answered 201 would tell
  // a PMS every re-delivery created a new reservation.
  @Post('v1/bookings')
  async upsertBooking(
    @Body(ValidationPipe) dto: UpsertBookingDto,
    @CurrentIntegrationHotelId() hotelId: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { record, created } = await this.bookingsService.upsertByExternalId(hotelId, dto);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return { success: true, message: this.constantsService.private.INTEGRATIONS.MSG_BOOKING_UPSERTED, data: record };
  }

  @Post('v1/requests')
  async upsertRequest(
    @Body(ValidationPipe) dto: UpsertRequestDto,
    @CurrentIntegrationHotelId() hotelId: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { record, created } = await this.requestsService.upsertByExternalId(hotelId, dto);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return { success: true, message: this.constantsService.private.INTEGRATIONS.MSG_REQUEST_UPSERTED, data: record };
  }

  @Post('providers/:provider/webhooks')
  async providerWebhook(
    @Param('provider') provider: string,
    @Body() body: any,
    @CurrentIntegrationHotelId() hotelId: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    const adapter = this.adapterRegistry.get(provider);
    if (!adapter) {
      throw new NotFoundException(this.constantsService.private.INTEGRATIONS.ERROR_UNKNOWN_PROVIDER);
    }
    adapter.verify(body);
    const items = adapter.parse(body);

    const results: unknown[] = [];
    let anyCreated = false;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const { record, created } =
        item.type === 'booking'
          ? await this.bookingsService.upsertByExternalId(hotelId, item.payload)
          : await this.requestsService.upsertByExternalId(hotelId, item.payload);
      if (created) anyCreated = true;
      results.push(record);
    }
    res.status(anyCreated ? HttpStatus.CREATED : HttpStatus.OK);

    return { success: true, message: this.constantsService.private.INTEGRATIONS.MSG_PROVIDER_WEBHOOK_PROCESSED, data: results };
  }
}
