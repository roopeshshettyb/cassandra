import { BookingExternalUpsertPayload } from '../../bookings/bookings.dto';
import { RequestExternalUpsertPayload } from '../../requests/requests.dto';

export type CanonicalUpsertItem =
  | { type: 'booking'; payload: BookingExternalUpsertPayload }
  | { type: 'request'; payload: RequestExternalUpsertPayload };

// Translates one provider's webhook payload shape into the canonical upsert
// calls — provider adapters only ever serialize into this, they never touch
// bookings/requests persistence directly.
export interface IntegrationProviderAdapter {
  // Throws if the request doesn't meet the provider's own verification scheme
  // (e.g. an HMAC signature header). Canonical: no-op, since IntegrationAuthGuard
  // already verified the Bearer integration token for every provider route.
  verify(req: any): void;

  parse(body: any): CanonicalUpsertItem[];
}
