import { DashboardService } from '../../../src/dashboard/dashboard.service';
import { RequestStatus, RequestUrgency } from '../../../src/requests/requests.model';
import { mock, staff } from '../helpers';

describe('DashboardService', () => {
  const today = new Date();
  const lastYear = new Date(today.getFullYear() - 1, 0, 1);

  it('summarises the bookings and requests the account can see', async () => {
    const bookingsService = mock({
      findAllForAccount: jest.fn(async () => ({
        data: [
          { get: () => ({ id: 1, hotelId: 1, isWithinStay: true, startTime: today, hotel: { name: 'A', logoUrl: 'l' } }) },
          { id: 2, hotelId: 1, isWithinStay: false, startTime: lastYear },
          { id: 3, hotelId: null },
        ],
      })),
    });
    const requestsService = mock({
      findAllForAccount: jest.fn(async () => ({
        data: [
          { id: 1, hotelId: 2, status: RequestStatus.PENDING, urgency: RequestUrgency.HIGH, hotel: { name: 'B' } },
          { id: 2, hotelId: 1, status: RequestStatus.COMPLETED, urgency: RequestUrgency.HIGH },
          { id: 3, hotelId: 1, status: RequestStatus.CANCELLED, urgency: RequestUrgency.LOW },
        ],
      })),
    });
    const me = staff();
    const { data } = await new DashboardService(bookingsService, requestsService).getDashboard(me);

    expect(bookingsService.findAllForAccount).toHaveBeenCalledWith(me);
    expect(requestsService.findAllForAccount).toHaveBeenCalledWith(me, { sortBy: 'urgency', sortOrder: 'desc' });
    expect(data.stats).toEqual({ totalBookings: 3, activeBookings: 1, pendingRequests: 1, completedRequests: 1, urgentRequests: 1 });
    // The cancelled request still counts as open on its hotel row, unlike in the action queue — see test/README.md.
    expect(data.propertyRows).toEqual([
      { id: 1, name: 'A', logoUrl: 'l', active: 1, arrivals: 1, open: 1 },
      { id: 2, name: 'B', logoUrl: null, active: 0, arrivals: 0, open: 1 },
    ]);
    expect(data.actionQueue.map((r: any) => r.id)).toEqual([1]);
    expect(data.recentBookings).toHaveLength(3);
  });

  // Known problem (test/README.md). Drop `.failing` once fixed, and the open: 1 above becomes 0.
  it.failing('does not count a cancelled request as open on its hotel row', async () => {
    const bookingsService = mock({ findAllForAccount: jest.fn(async () => ({ data: [] })) });
    const requestsService = mock({ findAllForAccount: jest.fn(async () => ({ data: [{ id: 1, hotelId: 1, status: RequestStatus.CANCELLED, urgency: RequestUrgency.LOW }] })) });
    const { data } = await new DashboardService(bookingsService, requestsService).getDashboard(staff());
    expect(data.propertyRows).toEqual([]);
  });
});
