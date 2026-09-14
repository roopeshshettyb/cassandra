export interface BookingQueryOptions {
  activeOnly?: boolean;
  hotelId?: number;
  roomNumber?: string;
  guestKeywords?: string;
  startAfter?: string;
  startBefore?: string;
  sortBy?: 'startTime' | 'endTime' | 'id';
  sortOrder?: 'asc' | 'desc';
  /** Agent-facing cap. Ignored once `pageSize` is supplied — see resolveListPaging. */
  limit?: number;
  page?: number;
  pageSize?: number;
}
