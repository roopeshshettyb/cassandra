import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { HotelIntegrationsRepository } from './hotel-integrations.repository';
import { HotelIntegrationsService } from './hotel-integrations.service';
import { HotelIntegrationsController } from './hotel-integrations.controller';
import { IntegrationsWebhookController } from './integrations.webhook.controller';
import { IntegrationAuthGuard } from './integration-auth.guard';
import { CanonicalAdapter } from './adapters/canonical.adapter';
import { AdapterRegistry } from './adapters/adapter.registry';
import { HotelsModule } from '../hotels/hotels.module';
import { BookingsModule } from '../bookings/bookings.module';
import { RequestsModule } from '../requests/requests.module';

@Module({
  imports: [DatabaseModule, CommonModule, forwardRef(() => HotelsModule), forwardRef(() => BookingsModule), forwardRef(() => RequestsModule)],
  controllers: [HotelIntegrationsController, IntegrationsWebhookController],
  providers: [HotelIntegrationsRepository, HotelIntegrationsService, IntegrationAuthGuard, CanonicalAdapter, AdapterRegistry],
  exports: [HotelIntegrationsService],
})
export class IntegrationsModule {}
