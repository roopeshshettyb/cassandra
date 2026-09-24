export interface BookingQueryOptions {
  activeOnly?: boolean;
  hotelId?: number;
  roomNumber?: string;
  guestKeywords?: string;
  startAfter?: string;
  startBefore?: string;
  sortBy?: 'startTime' | 'endTime' | 'id';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}
