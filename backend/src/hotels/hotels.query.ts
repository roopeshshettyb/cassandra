export interface HotelQueryOptions {
  keywords?: string;
  sortBy?: 'name' | 'id';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}
