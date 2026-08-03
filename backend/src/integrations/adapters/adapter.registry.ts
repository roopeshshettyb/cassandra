import { Injectable } from '@nestjs/common';
import { IntegrationProviderAdapter } from './adapter.interface';
import { CanonicalAdapter } from './canonical.adapter';

// Extend this map when a new PMS adapter is added — nothing else about the
// webhook route or upsert path needs to change.
@Injectable()
export class AdapterRegistry {
  private readonly adapters: Record<string, IntegrationProviderAdapter>;

  constructor(private readonly canonicalAdapter: CanonicalAdapter) {
    this.adapters = { canonical: this.canonicalAdapter };
  }

  get(provider: string): IntegrationProviderAdapter | null {
    return this.adapters[provider] ?? null;
  }
}
