import { Injectable } from '@nestjs/common';
import { Account } from '../accounts/accounts.model';
import { BookingsService } from '../bookings/bookings.service';
import { RequestsService } from '../requests/requests.service';
import { RequestStatus, RequestUrgency } from '../requests/requests.model';

@Injectable()
export class DashboardService {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly requestsService: RequestsService,
  ) {}

  async getDashboard(account: Account) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    const [{ data: bookings }, { data: requests }] = await Promise.all([
      this.bookingsService.findAllForAccount(account),
      this.requestsService.findForAccountWithOptions(account, { sortBy: 'urgency', sortOrder: 'desc' }),
    ]);

    let totalBookings = 0;
    let activeBookings = 0;
    const hotelMap: Record<number, { id: number; name: string; logoUrl: string | null; active: number; arrivals: number; open: number }> = {};
    const recentBookings: any[] = [];

    for (const b of bookings as any[]) {
      totalBookings++;
      if (b.isWithinStay) activeBookings++;
      if (recentBookings.length < 5) recentBookings.push(b);
      if (!b.hotelId) continue;
      if (!hotelMap[b.hotelId]) {
        hotelMap[b.hotelId] = { id: b.hotelId, name: b.hotel?.name || '—', logoUrl: b.hotel?.logoUrl || null, active: 0, arrivals: 0, open: 0 };
      }
      if (b.isWithinStay) hotelMap[b.hotelId].active++;
      if (b.startTime && new Date(b.startTime) >= todayStart && new Date(b.startTime) < todayEnd) {
        hotelMap[b.hotelId].arrivals++;
      }
    }

    const requestsCount = { pending: 0, completed: 0, urgent: 0 };
    const actionCandidates: any[] = [];
    const recentRequests: any[] = [];

    for (const r of requests) {
      if (r.status === RequestStatus.PENDING) requestsCount.pending++;
      if (r.status === RequestStatus.COMPLETED) requestsCount.completed++;
      if (r.urgency === RequestUrgency.HIGH && r.status !== RequestStatus.COMPLETED) requestsCount.urgent++;
      if (r.hotelId && r.status !== RequestStatus.COMPLETED) {
        if (!hotelMap[r.hotelId]) {
          hotelMap[r.hotelId] = { id: r.hotelId, name: r.hotel?.name || '—', logoUrl: null, active: 0, arrivals: 0, open: 0 };
        }
        hotelMap[r.hotelId].open++;
      }
      if (r.status !== RequestStatus.COMPLETED && r.status !== RequestStatus.CANCELLED) {
        actionCandidates.push(r);
      }
      if (recentRequests.length < 5) recentRequests.push(r);
    }

    return {
      success: true,
      message: null,
      data: {
        stats: { totalBookings, activeBookings, pendingRequests: requestsCount.pending, completedRequests: requestsCount.completed, urgentRequests: requestsCount.urgent },
        propertyRows: Object.values(hotelMap).sort((a, b) => b.open - a.open).slice(0, 6),
        actionQueue: actionCandidates.slice(0, 4),
        recentRequests,
        recentBookings,
      },
    };
  }
}
