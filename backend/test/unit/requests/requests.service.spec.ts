import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UniqueConstraintError } from 'sequelize';
import { RequestsService } from '../../../src/requests/requests.service';
import { mock, constants, admin, owner, staff, guest, row, loose } from '../helpers';

describe('RequestsService', () => {
  let requests: any, bookingsService: any, hotelsService: any, notifications: any;
  let service: RequestsService;
  const C = constants.private;

  beforeEach(() => {
    requests = mock({ create: jest.fn(async (data: any) => ({ id: 1, ...data })) });
    bookingsService = mock();
    hotelsService = mock({ findAllForAccount: jest.fn(async () => ({ data: [{ id: 1 }] })), findById: jest.fn(async () => ({ id: 1 })) });
    notifications = mock();
    service = new RequestsService(requests, bookingsService, hotelsService, notifications, constants);
  });

  describe('create', () => {
    const me = guest();
    const dto: any = { hotelId: 1, guestId: me.id, bookingId: 3, requestType: 'house_keeping', urgency: 'low' };
    const bookingIs = (data: any) => bookingsService.findByIdForAccount.mockResolvedValue({ data });

    it('lets a guest raise a request on their own booking, and notifies', async () => {
      bookingIs({ hotelId: 1, guestId: me.id });
      const res = await service.create(dto, me);
      expect(res).toMatchObject({ success: true, data: { hotelId: 1, userNotes: [], staffNotes: [], chatId: null } });
      expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'NEW_REQUEST' }));
    });

    it('lets staff raise one at their hotel', async () => {
      bookingIs({ hotelId: 1, guestId: me.id });
      const who = staff();
      await service.create(dto, who);
      expect(hotelsService.findByIdForAccount).toHaveBeenCalledWith(1, who);
    });

    it.each([[{ hotelId: 2, guestId: me.id }], [{ hotelId: 1, guestId: 999 }]])('refuses when the booking does not match (%p)', async (booking) => {
      bookingIs(booking);
      await expect(service.create(dto, admin())).rejects.toThrow(new BadRequestException('Booking does not match hotelId and guestId'));
      expect(requests.create).not.toHaveBeenCalled();
    });

    it('refuses an account with no known role', async () => {
      bookingIs({ hotelId: 1, guestId: me.id });
      await expect(service.create(dto, loose({ ...me, role: 'unknown' }))).rejects.toThrow(ForbiddenException);
    });

    it('refuses a guest raising a request for someone else', async () => {
      bookingIs({ hotelId: 1, guestId: 999 });
      await expect(service.create({ ...dto, guestId: 999 }, me)).rejects.toThrow(ForbiddenException);
    });

    it('passes NotFound through for a booking the account cannot see', async () => {
      bookingsService.findByIdForAccount.mockRejectedValue(new NotFoundException());
      await expect(service.create(dto, me)).rejects.toThrow(NotFoundException);
    });

    it('refuses staff of another hotel', async () => {
      bookingIs({ hotelId: 1, guestId: me.id });
      hotelsService.findByIdForAccount.mockRejectedValue(new NotFoundException());
      await expect(service.create(dto, staff())).rejects.toThrow(NotFoundException);
    });
  });

  describe('upsertByExternalId', () => {
    const payload: any = { externalId: 'r1', bookingExternalId: 'b1', requestType: 'room_service', urgency: 'high', status: 'pending', userNotes: ['x'] };

    it('creates a request against the booking the PMS names', async () => {
      bookingsService.findByExternalId.mockResolvedValue({ id: 3, guestId: 50 });
      requests.findOne.mockResolvedValue(null);
      await expect(service.upsertByExternalId(1, payload)).resolves.toMatchObject({ created: true, record: { bookingId: 3, guestId: 50, externalId: 'r1' } });
    });

    it('updates it on redelivery', async () => {
      const existing = row({ id: 9 });
      bookingsService.findByExternalId.mockResolvedValue({ id: 3, guestId: 50 });
      requests.findOne.mockResolvedValue(existing);
      await expect(service.upsertByExternalId(1, payload)).resolves.toMatchObject({ created: false });
      expect(existing).toMatchObject({ bookingId: 3, urgency: 'high', status: 'pending', userNotes: ['x'] });
    });

    it('refuses an unknown booking', async () => {
      bookingsService.findByExternalId.mockResolvedValue(null);
      await expect(service.upsertByExternalId(1, payload)).rejects.toThrow(new BadRequestException(C.INTEGRATIONS.ERROR_BOOKING_NOT_FOUND_FOR_REQUEST));
    });

    it('retries once on a concurrent create', async () => {
      bookingsService.findByExternalId.mockResolvedValue({ id: 3, guestId: 50 });
      requests.findOne.mockResolvedValue(null);
      requests.create.mockRejectedValueOnce(new UniqueConstraintError({}));
      await expect(service.upsertByExternalId(1, payload)).resolves.toMatchObject({ created: true });
      expect(requests.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('reading', () => {
    it('scopes a guest to their own requests', async () => {
      const me = guest();
      requests.findAll.mockResolvedValue([]);
      await service.findAllForAccount(me, {});
      expect(requests.findAll.mock.calls[0][0].where).toMatchObject({ guestId: me.id });
    });

    it('lets an admin see everything', async () => {
      requests.findAll.mockResolvedValue([]);
      await service.findAllForAccount(admin(), loose({ sortBy: 'urgency', sortOrder: 'asc' }));
      expect(requests.findAll.mock.calls[0][0].where).toEqual({});
    });

    it('matches nothing for staff without hotels', async () => {
      hotelsService.findAllForAccount.mockResolvedValue({ data: [] });
      requests.findAll.mockResolvedValue([]);
      await service.findAllForAccount(owner(), {});
      expect(requests.findAll.mock.calls[0][0].where.hotelId).toBe(-1);
    });

    it('rejects an unknown filter', async () => {
      await expect(service.findAllForAccount(admin(), loose({ bogus: '1' }))).rejects.toThrow(BadRequestException);
    });

    it('findByIdForAccount returns a request in scope', async () => {
      requests.findOne.mockResolvedValue({ id: 1 });
      await expect(service.findByIdForAccount(1, guest())).resolves.toMatchObject({ data: { id: 1 } });
    });

    it('findByIdForAccount throws NotFound outside the scope', async () => {
      requests.findOne.mockResolvedValue(null);
      await expect(service.findByIdForAccount(1, guest())).rejects.toThrow(NotFoundException);
    });

    it('findByBookingId applies filters, checks hotel access and uses the default limit', async () => {
      requests.findAll.mockResolvedValue([]);
      const who = staff();
      await service.findByBookingId(3, who, loose({ hotelId: 1, status: 'pending', requestType: 'x', urgency: 'low' }));
      const options = requests.findAll.mock.calls[0][0];
      expect(hotelsService.findByIdForAccount).toHaveBeenCalledWith(1, who);
      expect(options.where).toMatchObject({ bookingId: 3, hotelId: 1, status: 'pending', requestType: 'x', urgency: 'low' });
      expect(options.limit).toBe(C.AGENT_REQUESTS_DEFAULT_LIMIT);
    });

    it('findForAccountWithOptions caps the limit', async () => {
      requests.findAll.mockResolvedValue([]);
      await service.findForAccountWithOptions(admin(), loose({ limit: 9999 }));
      expect(requests.findAll.mock.calls[0][0].limit).toBe(C.AGENT_REQUESTS_MAX_LIMIT);
    });

    it('getListFilterMeta wraps the filters', () => {
      expect(service.getListFilterMeta()).toMatchObject({ success: true, data: expect.any(Object) });
    });
  });

  describe('update', () => {
    it('lets staff change status and urgency, and notifies', async () => {
      const request = row({ id: 1, hotelId: 1 });
      requests.findOne.mockResolvedValue(request);
      await expect(service.update(1, loose({ status: 'completed', urgency: 'high' }), staff())).resolves.toMatchObject({ success: true, message: C.REQUESTS.MSG_UPDATED });
      expect(request.update).toHaveBeenCalledWith({ status: 'completed', urgency: 'high' });
      expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'REQUEST_UPDATED' }));
    });

    it('lets a guest change other fields of their own request', async () => {
      requests.findOne.mockResolvedValue(row({ id: 1, hotelId: 1 }));
      await expect(service.update(1, loose({ userNotes: [] }), guest())).resolves.toMatchObject({ success: true });
    });

    it.each([{ status: 'completed' }, { urgency: 'high' }])('refuses a guest changing %p', async (dto) => {
      requests.findOne.mockResolvedValue(row({ id: 1 }));
      await expect(service.update(1, loose(dto), guest())).rejects.toThrow(new ForbiddenException(C.REQUESTS.ERROR_STAFF_ONLY_FIELDS));
    });

    it('throws NotFound outside the scope', async () => {
      requests.findOne.mockResolvedValue(null);
      await expect(service.update(1, loose({}), staff())).rejects.toThrow(NotFoundException);
    });
  });

  describe('appendMessage', () => {
    it('adds a guest note to their own request', async () => {
      const me = guest();
      const request = row({ id: 1, hotelId: 1, guestId: me.id, userNotes: [{ text: 'old' }] });
      requests.findOne.mockResolvedValue(request);
      await expect(service.appendMessage(1, 'hello', me)).resolves.toMatchObject({ success: true });
      expect(request.update.mock.calls[0][0].userNotes).toEqual([{ text: 'old' }, expect.objectContaining({ text: 'hello', accountId: me.id })]);
      expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'NEW_MESSAGE', messagePreview: 'hello' }));
    });

    it('refuses a guest note on another guest request', async () => {
      requests.findOne.mockResolvedValue(row({ id: 1, guestId: 999 }));
      await expect(service.appendUserMessage(1, 'x', guest())).rejects.toThrow(ForbiddenException);
    });

    it('adds a staff note after checking hotel access', async () => {
      const who = staff();
      const request = row({ id: 1, hotelId: 1, staffNotes: null });
      requests.findOne.mockResolvedValue(request);
      await service.appendMessage(1, 'on it', who);
      expect(hotelsService.findByIdForAccount).toHaveBeenCalledWith(1, who);
      expect(request.update.mock.calls[0][0].staffNotes).toEqual([expect.objectContaining({ text: 'on it' })]);
    });

    it('lets an admin add a staff note without a hotel check', async () => {
      requests.findOne.mockResolvedValue(row({ id: 1, hotelId: 1 }));
      await service.appendMessage(1, 'x', admin());
      expect(hotelsService.findByIdForAccount).not.toHaveBeenCalled();
    });

    it.each([
      ['guest', guest],
      ['staff', staff],
    ])('throws NotFound for %s outside the scope', async (_name, who) => {
      requests.findOne.mockResolvedValue(null);
      await expect(service.appendMessage(1, 'x', who())).rejects.toThrow(NotFoundException);
    });
  });
});
