import { Injectable } from '@nestjs/common';
import { ConstantsService } from './common/constants/constants.service';
import { BookingsService } from './bookings/bookings.service';
import { RequestsService } from './requests/requests.service';
import { Account } from './accounts/accounts.model';
import { RequestStatus, RequestUrgency } from './requests/requests.model';

@Injectable()
export class AppService {
  constructor(
    private constantsService: ConstantsService,
    private bookingsService: BookingsService,
    private requestsService: RequestsService,
  ) {}

  getHello(): string {
    return `${this.constantsService.public.APP_NAME} API is running!`;
  }

  async getDashboard(account: Account) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    const [{ data: bookings }, { data: requests }] = await Promise.all([
      this.bookingsService.findAllForAccount(account),
      this.requestsService.findAllForAccount(account),
    ]);

    let totalBookings = 0;
    let activeBookings = 0;
    const hotelMap: Record<number, { name: string; logoUrl: string | null; active: number; arrivals: number; open: number }> = {};
    const recentBookings: any[] = [];

    for (const b of bookings) {
      totalBookings++;
      if (b.isWithinStay) activeBookings++;
      if (recentBookings.length < 5) recentBookings.push(b);
      if (!b.hotelId) continue;
      if (!hotelMap[b.hotelId]) {
        hotelMap[b.hotelId] = { name: b.hotel?.name || '—', logoUrl: b.hotel?.logoUrl || null, active: 0, arrivals: 0, open: 0 };
      }
      if (b.isWithinStay) hotelMap[b.hotelId].active++;
      if (b.startTime && new Date(b.startTime) >= todayStart && new Date(b.startTime) < todayEnd) {
        hotelMap[b.hotelId].arrivals++;
      }
    }

    let pendingRequests = 0;
    let completedRequests = 0;
    let urgentRequests = 0;
    const actionCandidates: any[] = [];
    const recentRequests: any[] = [];

    for (const r of requests) {
      if (r.status === RequestStatus.PENDING) pendingRequests++;
      if (r.status === RequestStatus.COMPLETED) completedRequests++;
      if (r.urgency === RequestUrgency.HIGH && r.status !== RequestStatus.COMPLETED) urgentRequests++;
      if (r.hotelId && r.status !== RequestStatus.COMPLETED) {
        if (!hotelMap[r.hotelId]) {
          hotelMap[r.hotelId] = { name: r.hotel?.name || '—', logoUrl: null, active: 0, arrivals: 0, open: 0 };
        }
        hotelMap[r.hotelId].open++;
      }
      if (r.status !== RequestStatus.COMPLETED && r.status !== RequestStatus.CANCELLED) {
        actionCandidates.push(r);
      }
      if (recentRequests.length < 5) recentRequests.push(r);
    }

    const URGENCY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
    actionCandidates.sort((a, b) => (URGENCY_ORDER[a.urgency] ?? 3) - (URGENCY_ORDER[b.urgency] ?? 3));

    return {
      success: true,
      message: null,
      data: {
        stats: { totalBookings, activeBookings, pendingRequests, completedRequests, urgentRequests },
        propertyRows: Object.values(hotelMap).sort((a, b) => b.open - a.open).slice(0, 6),
        actionQueue: actionCandidates.slice(0, 4),
        recentRequests,
        recentBookings,
      },
    };
  }
}
