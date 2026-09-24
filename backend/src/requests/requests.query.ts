import { RequestStatus, RequestType, RequestUrgency } from './requests.model';

export interface RequestQueryOptions {
  status?: RequestStatus;
  requestType?: RequestType;
  urgency?: RequestUrgency;
  hotelId?: number;
  bookingId?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'urgency';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}
