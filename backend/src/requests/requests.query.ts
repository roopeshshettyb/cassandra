import { RequestStatus, RequestType, RequestUrgency } from './requests.model';

export interface RequestQueryOptions {
  status?: RequestStatus | RequestStatus[];
  requestType?: RequestType | RequestType[];
  urgency?: RequestUrgency | RequestUrgency[];
  hotelId?: number;
  bookingId?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'urgency';
  sortOrder?: 'asc' | 'desc';
  /** Agent-facing cap. Ignored once `pageSize` is supplied — see resolveListPaging. */
  limit?: number;
  page?: number;
  pageSize?: number;
}
