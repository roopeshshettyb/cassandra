import { BadRequestException, Injectable } from '@nestjs/common';
import { IntegrationProviderAdapter, CanonicalUpsertItem } from './adapter.interface';
import { ConstantsService } from '../../common/constants/constants.service';

// Shape of the Mews Connector API reservation payload we consume. Only the fields
// we actually map are declared — Mews sends ~40 per reservation.
interface MewsReservation {
  Id?: string;
  Number?: string | number;
  State?: string;
  StartUtc?: string;
  EndUtc?: string;
  ScheduledStartUtc?: string;
  ScheduledEndUtc?: string;
  AccountId?: string;
  CustomerId?: string;
  AssignedResourceId?: string;
}

interface MewsCustomer {
  Id?: string;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  Phone?: string;
}

interface MewsResource {
  Id?: string;
  Name?: string;
}

// Mews reservation states that mean "this stay is not happening". We skip them
// rather than upserting, because our booking model has no cancelled state and a
// cancelled stay must not appear as an active one to a guest.
const NON_ACTIVE_STATES = new Set(['canceled', 'cancelled', 'declined']);

/**
 * Mews Connector API -> canonical booking upsert.
 *
 * Mews sends reservations, customers and resources as three parallel arrays keyed
 * by id rather than one nested object, so the adapter joins them before mapping.
 *
 * Guest email is required by the canonical upsert (it is how a guest account is
 * matched or created) but Mews does not inline it on the reservation. A payload
 * whose reservations cannot be joined to a customer with an email is rejected
 * outright — inventing a placeholder address would silently create junk guest
 * accounts and attach real stays to them.
 */
@Injectable()
export class MewsAdapter implements IntegrationProviderAdapter {
  constructor(private readonly constantsService: ConstantsService) {}

  verify(): void {
    // Bearer integration token already verified by IntegrationAuthGuard. Mews'
    // own webhook signing would be checked here once we hold a per-hotel secret.
  }

  parse(body: any): CanonicalUpsertItem[] {
    const config = this.constantsService.private.INTEGRATIONS;

    const reservations: MewsReservation[] = body?.Reservations;
    if (!Array.isArray(reservations) || reservations.length === 0) {
      throw new BadRequestException(config.ERROR_MEWS_NO_RESERVATIONS);
    }

    const customersById: Record<string, MewsCustomer> = {};
    const customers: MewsCustomer[] = Array.isArray(body?.Customers) ? body.Customers : [];
    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];
      if (customer?.Id) customersById[customer.Id] = customer;
    }

    const resourcesById: Record<string, MewsResource> = {};
    const resources: MewsResource[] = Array.isArray(body?.Resources) ? body.Resources : [];
    for (let i = 0; i < resources.length; i++) {
      const resource = resources[i];
      if (resource?.Id) resourcesById[resource.Id] = resource;
    }

    const items: CanonicalUpsertItem[] = [];
    for (let i = 0; i < reservations.length; i++) {
      const reservation = reservations[i];

      if (!reservation?.Id) {
        throw new BadRequestException(config.ERROR_MEWS_RESERVATION_MISSING_ID);
      }
      if (reservation.State && NON_ACTIVE_STATES.has(String(reservation.State).toLowerCase())) {
        continue;
      }

      // Mews sends both scheduled and actual times; the scheduled ones are what a
      // guest was told, so they win when present.
      const start = reservation.ScheduledStartUtc || reservation.StartUtc;
      const end = reservation.ScheduledEndUtc || reservation.EndUtc;
      if (!start || !end) {
        throw new BadRequestException(`${config.ERROR_MEWS_RESERVATION_MISSING_DATES}: ${reservation.Id}`);
      }

      const customerId = reservation.CustomerId || reservation.AccountId;
      const customer = customerId ? customersById[customerId] : undefined;
      const email = customer?.Email?.trim();
      if (!email) {
        throw new BadRequestException(`${config.ERROR_MEWS_RESERVATION_NO_GUEST_EMAIL}: ${reservation.Id}`);
      }

      const name = [customer.FirstName, customer.LastName].filter(Boolean).join(' ').trim();
      const room = reservation.AssignedResourceId ? resourcesById[reservation.AssignedResourceId]?.Name : undefined;

      items.push({
        type: 'booking',
        payload: {
          // Mews' Id is the stable key across updates; Number is the human-facing
          // confirmation and can be reissued, so it must not be the upsert key.
          externalId: reservation.Id,
          startDate: this.toDateOnly(start),
          endDate: this.toDateOnly(end),
          guestEmail: email,
          guestName: name || email,
          guestPhone: customer.Phone?.trim() || undefined,
          roomNumber: room || undefined,
        },
      });
    }

    if (items.length === 0) {
      throw new BadRequestException(config.ERROR_MEWS_NO_ACTIVE_RESERVATIONS);
    }

    return items;
  }

  // Mews sends full UTC timestamps; the canonical payload takes YYYY-MM-DD and
  // applies the hotel's own check-in/out times.
  private toDateOnly(utc: string): string {
    return String(utc).slice(0, 10);
  }
}
