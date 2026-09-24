import { ListQuery } from '../common/filters/list-filters';

/**
 * Column filters are deliberately not listed: they come from the `filterable`/`searchable` columns
 * on the Hotel model and ride along in the index signature, checked at runtime against it. Only the
 * agent-facing keys, which predate the generic query, are named here.
 */
export interface HotelQueryOptions extends ListQuery {
  /** The agent tools' name for the search box; mapped onto `search` by the service. */
  keywords?: string;
  sortBy?: 'name' | 'id';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}
