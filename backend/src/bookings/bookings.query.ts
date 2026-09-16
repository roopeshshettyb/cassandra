export interface BookingQueryOptions {
  /** Agent-facing boolean, equivalent to stay: 'active'. */
  activeOnly?: boolean;
  /** UI-facing stay mode; takes precedence over activeOnly. */
  stay?: 'active' | 'upcoming';
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
