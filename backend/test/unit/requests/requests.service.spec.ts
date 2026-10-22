import { ForbiddenException } from '@nestjs/common';
import { UniqueConstraintError } from 'sequelize';
import { RequestsService } from '../../../src/requests/requests.service';
import { mock, constants, owner, staff, guest, row, loose } from '../helpers';

describe('RequestsService', () => {
  let requests: any, bookingsService: any, hotelsService: any, notifications: any;
  let service: RequestsService;
  const C = constants.private;

  beforeEach(() => {
    requests = mock({ create: jest.fn(async (data: any) => ({ id: 1, ...data })) });
    bookingsService = mock();
    hotelsService = mock({ findAllForAccount: jest.fn(async () => ({ data: [{ id: 1 }] })) });
    notifications = mock();
    service = new RequestsService(requests, bookingsService, hotelsService, notifications, constants);
  });

  describe('create', () => {
    const me = guest();
    const dto: any = { hotelId: 1, guestId: me.id, bookingId: 3, requestType: 'house_keeping', urgency: 'low' };

    it('notifies the hotel of a new request', async () => {
      bookingsService.findByIdForAccount.mockResolvedValue({ data: { hotelId: 1, guestId: me.id } });
      await expect(service.create(dto, me)).resolves.toMatchObject({ success: true, data: { hotelId: 1, userNotes: [], staffNotes: [], chatId: null } });
      expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'NEW_REQUEST' }));
    });

    it('refuses a guest raising a request for someone else', async () => {
      bookingsService.findByIdForAccount.mockResolvedValue({ data: { hotelId: 1, guestId: 999 } });
      await expect(service.create({ ...dto, guestId: 999 }, me)).rejects.toThrow(ForbiddenException);
    });
  });

  it('retries once when a concurrent PMS delivery created the request first', async () => {
    bookingsService.findByExternalId.mockResolvedValue({ id: 3, guestId: 50 });
    requests.findOne.mockResolvedValue(null);
    requests.create.mockRejectedValueOnce(new UniqueConstraintError({}));
    const payload: any = { externalId: 'r1', bookingExternalId: 'b1', requestType: 'room_service', urgency: 'high', status: 'pending', userNotes: ['x'] };
    await expect(service.upsertByExternalId(1, payload)).resolves.toMatchObject({ created: true });
    expect(requests.create).toHaveBeenCalledTimes(2);
  });

  it('matches no request for staff without hotels, rather than every request', async () => {
    hotelsService.findAllForAccount.mockResolvedValue({ data: [] });
    requests.findAll.mockResolvedValue([]);
    await service.findAllForAccount(owner(), {});
    expect(requests.findAll.mock.calls[0][0].where.hotelId).toBe(-1);
  });

  it("findByBookingId (the concierge's lookup) applies filters, checks hotel access and uses the default limit", async () => {
    requests.findAll.mockResolvedValue([]);
    const who = staff();
    await service.findByBookingId(3, who, loose({ hotelId: 1, status: 'pending', requestType: 'x', urgency: 'low' }));
    const options = requests.findAll.mock.calls[0][0];
    expect(hotelsService.findByIdForAccount).toHaveBeenCalledWith(1, who);
    expect(options.where).toMatchObject({ bookingId: 3, hotelId: 1, status: 'pending', requestType: 'x', urgency: 'low' });
    expect(options.limit).toBe(C.AGENT_REQUESTS_DEFAULT_LIMIT);
  });

  it("refuses a guest note on another guest's request", async () => {
    requests.findOne.mockResolvedValue(row({ id: 1, guestId: 999 }));
    await expect(service.appendUserMessage(1, 'x', guest())).rejects.toThrow(ForbiddenException);
  });
});
