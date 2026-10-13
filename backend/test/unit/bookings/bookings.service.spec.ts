import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Op, UniqueConstraintError } from 'sequelize';
import { BookingsService } from '../../../src/bookings/bookings.service';
import { BookingRoom } from '../../../src/bookings/booking-rooms.model';
import { RoomType } from '../../../src/rooms/room-types.model';
import { Room } from '../../../src/rooms/rooms.model';
import { Request } from '../../../src/requests/requests.model';
import { Chat } from '../../../src/chat/chat.model';
import { Message } from '../../../src/messages/message.model';
import { Cost } from '../../../src/costs/costs.model';
import { BookingStatus } from '../../../src/common/constants/constants.service';
import { AccountRole } from '../../../src/accounts/accounts.model';
import { mock, constants, admin, owner, staff, guest, row, sequelize, loose } from '../helpers';

describe('BookingsService', () => {
  let bookings: any, accountsService: any, authService: any, hotelsService: any, mailer: any, aws: any, extraction: any, costs: any, notifications: any, inventory: any, db: any;
  let service: BookingsService;
  const C = constants.private;
  const hotel = { id: 1, name: 'Grand', checkInTime: '14:00', checkOutTime: '11:00' };
  const guestAccount = { id: 50, email: 'g@x', name: 'G' };
  const prefix = C.AWS_S3_KEY_PREFIX;

  beforeEach(() => {
    db = sequelize();
    bookings = mock({ sequelize: db, create: jest.fn(async (data: any) => row({ id: 99, ...data })) });
    accountsService = mock({ findOrCreateByEmail: jest.fn(async () => ({ account: guestAccount, created: true })) });
    authService = mock({ generateInviteToken: jest.fn(async () => 'tok') });
    hotelsService = mock({ findByIdForAccount: jest.fn(async () => hotel), findById: jest.fn(async () => hotel), findAllForAccount: jest.fn(async () => ({ data: [{ id: 1 }, { id: 2 }] })) });
    mailer = mock({ buildBaseEmailHtml: jest.fn((h: string) => h) });
    aws = mock({ getSignedUrl: jest.fn(async () => 'https://signed'), getPresignedPutUrl: jest.fn(async () => 'https://put') });
    extraction = mock();
    costs = mock();
    notifications = mock();
    inventory = mock({
      nightsBetween: jest.fn((a: Date, b: Date) => (b > a && b.toDateString() !== a.toDateString() ? ['2026-01-01'] : [])),
      toDateOnly: jest.fn((d: Date) => d.toISOString().slice(0, 10)),
      findFreeRooms: jest.fn(async () => [{ id: 7, roomNumber: '101' }]),
    });
    service = new BookingsService(bookings, accountsService, authService, hotelsService, mailer, constants, aws, extraction, costs, notifications, inventory);
    jest.spyOn(BookingRoom, 'bulkCreate').mockResolvedValue(loose([]));
    jest.spyOn(BookingRoom, 'destroy').mockResolvedValue(loose(0));
    jest.spyOn(BookingRoom, 'count').mockResolvedValue(loose(0));
  });

  afterEach(() => jest.restoreAllMocks());

  describe('createBooking', () => {
    const dto: any = { hotelId: 1, startDate: '2026-01-01', endDate: '2026-01-03', guestEmail: 'g@x', guestName: 'G', roomNumber: ' 12 ' };

    it('creates the guest and a booking at the hotel check-in/out times, and notifies', async () => {
      const res = await service.createBooking(dto, staff());
      expect(res).toMatchObject({ success: true, data: { id: 99, guestId: 50, hotelId: 1, roomNumber: '12' } });
      expect(res.data.startTime).toEqual(new Date(2026, 0, 1, 14, 0));
      expect(res.data.endTime).toEqual(new Date(2026, 0, 3, 11, 0));
      expect(accountsService.findOrCreateByEmail).toHaveBeenCalledWith('g@x', expect.objectContaining({ role: AccountRole.GUEST }));
      expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'NEW_BOOKING' }));
      expect(mailer.sendMail).not.toHaveBeenCalled();
    });

    it('emails the guest an invite when asked to', async () => {
      const res = await service.createBooking({ ...dto, sendInviteImmediately: true }, staff());
      expect(mailer.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'g@x', text: expect.stringContaining(encodeURIComponent('/bookings/99')) }));
      expect(res.data.inviteEmailSentAt).toBeInstanceOf(Date);
    });

    it('moves an uploaded reservation document from temp to the booking', async () => {
      const res = await service.createBooking({ ...dto, reservationDocumentKey: `${prefix}temp/abc.pdf` }, staff());
      expect(aws.copyObject).toHaveBeenCalledWith(`${prefix}temp/abc.pdf`, expect.stringMatching(new RegExp(`^${prefix}bookings/99/.*\\.pdf$`)), false);
      expect(aws.deleteObject).toHaveBeenCalledWith(`${prefix}temp/abc.pdf`, false);
      expect(res.data.reservationDocumentS3Key).toContain('bookings/99/');
    });

    it('refuses a reservation document outside the temp folder', async () => {
      await expect(service.createBooking({ ...dto, reservationDocumentKey: `${prefix}bookings/1/x.pdf` }, staff())).rejects.toThrow(new BadRequestException('Invalid reservation document key'));
    });

    it('refuses a guest', async () => {
      await expect(service.createBooking(dto, guest())).rejects.toThrow(ForbiddenException);
    });

    it('passes NotFound through for a hotel the account cannot see', async () => {
      hotelsService.findByIdForAccount.mockRejectedValue(new NotFoundException());
      await expect(service.createBooking(dto, owner())).rejects.toThrow(NotFoundException);
    });

    it('refuses an end date before the start date', async () => {
      await expect(service.createBooking({ ...dto, endDate: '2025-12-31' }, admin())).rejects.toThrow(new BadRequestException('endDate must be on or after startDate'));
    });

    it('requires a guest email', async () => {
      await expect(service.createBooking({ ...dto, guestEmail: '  ' }, admin())).rejects.toThrow(new BadRequestException('Guest email is required'));
    });

    describe('with a room type', () => {
      const typed = { ...dto, roomNumber: undefined, roomTypeId: 5, rooms: 1 };
      beforeEach(() => jest.spyOn(RoomType, 'findByPk').mockResolvedValue(loose({ id: 5, hotelId: 1 })));

      it('reserves inventory, picks free rooms and names them on the booking', async () => {
        const res = await service.createBooking(typed, staff());
        expect(inventory.reserveInventoryOrFail).toHaveBeenCalledWith(5, ['2026-01-01'], 1, expect.anything());
        expect(BookingRoom.bulkCreate).toHaveBeenCalledWith([expect.objectContaining({ bookingId: 99, roomId: 7 })], expect.anything());
        expect(res.data.roomNumber).toBe('101');
      });

      it('refuses when fewer rooms are free than wanted', async () => {
        inventory.findFreeRooms.mockResolvedValue([]);
        await expect(service.createBooking(typed, staff())).rejects.toThrow(new ConflictException('Not enough rooms available for the selected dates'));
      });

      it('passes an inventory refusal through', async () => {
        inventory.reserveInventoryOrFail.mockRejectedValue(new ConflictException('Not enough rooms available for the selected dates'));
        await expect(service.createBooking(typed, staff())).rejects.toThrow(ConflictException);
        expect(bookings.create).not.toHaveBeenCalled();
      });

      it('refuses a same-day stay', async () => {
        await expect(service.createBooking({ ...typed, endDate: typed.startDate }, staff())).rejects.toThrow(new BadRequestException('Check-out must be after check-in to reserve a room'));
      });

      it.each([[null], [{ id: 5, hotelId: 2 }]])('hides a room type of another hotel (%p)', async (roomType) => {
        jest.spyOn(RoomType, 'findByPk').mockResolvedValue(loose(roomType));
        await expect(service.createBooking(typed, staff())).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('upsertByExternalId', () => {
    const payload: any = { externalId: 'pms-1', startDate: '2026-01-01', endDate: '2026-01-02', guestEmail: 'g@x', roomNumber: '101' };
    beforeEach(() => jest.spyOn(Room, 'findOne').mockResolvedValue(null));

    it('creates a booking the first time', async () => {
      bookings.findOne.mockResolvedValue(null);
      const { record, created } = await service.upsertByExternalId(1, payload);
      expect(created).toBe(true);
      expect(record).toMatchObject({ hotelId: 1, externalId: 'pms-1', roomNumber: '101' });
    });

    it('updates the same booking on redelivery', async () => {
      const existing = row({ id: 3, hotelId: 1, roomNumber: '100' });
      bookings.findOne.mockResolvedValue(existing);
      const { record, created } = await service.upsertByExternalId(1, payload);
      expect(created).toBe(false);
      expect(record).toBe(existing);
      expect(existing).toMatchObject({ roomNumber: '101', guestId: 50 });
      expect(existing.save).toHaveBeenCalled();
    });

    it('reserves the room the PMS names', async () => {
      jest.spyOn(Room, 'findOne').mockResolvedValue(loose({ id: 7, roomTypeId: 5, roomNumber: '101' }));
      bookings.findOne.mockResolvedValue(null);
      await service.upsertByExternalId(1, payload);
      expect(inventory.reservePmsInventoryUpToCapacity).toHaveBeenCalledWith(5, ['2026-01-01'], 1, expect.anything());
      expect(BookingRoom.bulkCreate).toHaveBeenCalled();
    });

    it('retries once when a concurrent delivery created it first', async () => {
      bookings.findOne.mockRejectedValueOnce(new UniqueConstraintError({})).mockResolvedValue(null);
      await expect(service.upsertByExternalId(1, payload)).resolves.toMatchObject({ created: true });
    });

    it('gives up after a second conflict', async () => {
      bookings.findOne.mockRejectedValue(new UniqueConstraintError({}));
      await expect(service.upsertByExternalId(1, payload)).rejects.toThrow(UniqueConstraintError);
    });

    it('refuses an end date before the start date', async () => {
      await expect(service.upsertByExternalId(1, { ...payload, endDate: '2025-01-01' })).rejects.toThrow(new BadRequestException('endDate must be on or after startDate'));
    });
  });

  describe('reservation documents', () => {
    const key = `${prefix}temp/doc.pdf`;

    it('gives a presigned upload url under temp/', async () => {
      const res = await service.getReservationDocumentUploadUrl(staff(), 'application/pdf');
      expect(res.data).toEqual({ uploadUrl: 'https://put', key: expect.stringMatching(new RegExp(`^${prefix}temp/.+\\.pdf$`)) });
    });

    it('extracts fields from an uploaded document', async () => {
      extraction.extractFromDocumentUrl.mockResolvedValue({ startDate: '2026-01-01' });
      await expect(service.extractFromReservationDocumentByKey(key, staff())).resolves.toMatchObject({ data: { startDate: '2026-01-01' } });
      expect(extraction.extractFromDocumentUrl).toHaveBeenCalledWith('https://signed', true);
    });

    it.each(['extractFromReservationDocumentByKey', 'createFromReservationDocumentByKey'])('%s refuses a key outside temp/', async (method) => {
      await expect(loose(service)[method]('other/doc.pdf', staff())).rejects.toThrow(new BadRequestException('Invalid reservation document key'));
    });

    describe('createFromReservationDocumentByKey', () => {
      const fields = { startDate: '2026-01-01', endDate: '2026-01-02', guestEmail: 'g@x', hotelName: 'grand' };

      it('creates the booking at the one hotel whose name matches', async () => {
        extraction.extractFromDocumentUrl.mockResolvedValue(fields);
        hotelsService.findAllForAccount.mockResolvedValue({
          data: [
            { id: 1, name: 'The Grand' },
            { id: 2, name: 'Other' },
          ],
        });
        const res = await service.createFromReservationDocumentByKey(key, staff());
        expect(res.data).toMatchObject({ hotelId: 1, reservationDocumentS3Key: expect.stringContaining('bookings/99/') });
      });

      it('reports an extraction failure as BadRequest', async () => {
        extraction.extractFromDocumentUrl.mockRejectedValue({});
        await expect(service.createFromReservationDocumentByKey(key, staff())).rejects.toThrow(new BadRequestException('Could not extract booking details from reservation document'));
      });

      it('refuses when several hotels match', async () => {
        extraction.extractFromDocumentUrl.mockResolvedValue(fields);
        hotelsService.findAllForAccount.mockResolvedValue({
          data: [
            { id: 1, name: 'Grand A' },
            { id: 2, name: 'Grand B' },
          ],
        });
        await expect(service.createFromReservationDocumentByKey(key, staff())).rejects.toThrow(
          new BadRequestException('Multiple hotels match the reservation document. Please create the booking from the form and select the hotel.'),
        );
      });

      it('lists every missing field', async () => {
        extraction.extractFromDocumentUrl.mockResolvedValue({});
        const expected =
          'Could not create booking: missing startDate, endDate, guestEmail, hotel (could not match hotel name from reservation document). ' +
          'Please ensure the reservation document contains all required details or create the booking from the form.';
        await expect(service.createFromReservationDocumentByKey(key, staff())).rejects.toThrow(new BadRequestException(expected));
      });
    });

    describe('getReservationDocumentViewUrl', () => {
      it('signs the stored document', async () => {
        bookings.findOne.mockResolvedValue(row({ id: 1, reservationDocumentS3Key: 'k' }));
        await expect(service.getReservationDocumentViewUrl(1, admin())).resolves.toMatchObject({ data: { url: 'https://signed' } });
      });

      it('throws NotFound when the booking has no document', async () => {
        bookings.findOne.mockResolvedValue(row({ id: 1 }));
        await expect(service.getReservationDocumentViewUrl(1, admin())).rejects.toThrow(NotFoundException);
      });

      it('throws NotFound for a booking the account cannot see', async () => {
        bookings.findOne.mockResolvedValue(null);
        await expect(service.getReservationDocumentViewUrl(1, guest())).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('sendPendingInviteEmails', () => {
    it('invites each guest in their stay, and one failure does not stop the rest', async () => {
      const ok = row({ id: 1, endTime: new Date(), guest: { email: 'a@x' }, hotel });
      const fails = row({ id: 2, endTime: new Date(), guest: { email: 'b@x' }, hotel });
      const noEmail = row({ id: 3, endTime: new Date(), guest: {}, hotel });
      bookings.findAll.mockResolvedValue([fails, ok, noEmail]);
      mailer.sendMail.mockRejectedValueOnce(new Error('smtp')).mockResolvedValue(undefined);
      await service.sendPendingInviteEmails();
      expect(mailer.sendMail).toHaveBeenCalledTimes(2);
      expect(ok.inviteEmailSentAt).toBeInstanceOf(Date);
      expect(noEmail.save).not.toHaveBeenCalled();
    });
  });

  describe('scoping', () => {
    it('findActiveForGuest returns the current stay', async () => {
      bookings.findOne.mockResolvedValue({ id: 1 });
      await expect(service.findActiveForGuest(guest())).resolves.toMatchObject({ data: { id: 1 } });
    });

    it.each([
      ['admin', admin],
      ['staff', staff],
    ])('findActiveForGuest refuses %s', async (_name, who) => {
      await expect(service.findActiveForGuest(who())).rejects.toThrow(ForbiddenException);
    });

    it('findAllForAccount scopes a guest to their own bookings', async () => {
      const me = guest();
      bookings.findAll.mockResolvedValue([]);
      await service.findAllForAccount(me, {});
      expect(bookings.findAll.mock.calls[0][0].where).toMatchObject({ guestId: me.id });
    });

    it('findAllForAccount scopes staff to their hotels', async () => {
      bookings.findAll.mockResolvedValue([]);
      await service.findAllForAccount(staff(), {});
      expect(hotelsService.findAllForAccount).toHaveBeenCalled();
      expect(bookings.findAll.mock.calls[0][0].where.hotelId).toEqual({ [Op.in]: [1, 2] });
    });

    it('findAllForAccount matches nothing for staff without hotels', async () => {
      hotelsService.findAllForAccount.mockResolvedValue({ data: [] });
      bookings.findAll.mockResolvedValue([]);
      await service.findAllForAccount(owner(), {});
      expect(bookings.findAll.mock.calls[0][0].where.hotelId).toBe(-1);
    });

    it('findAllForAccount rejects an unknown filter', async () => {
      await expect(service.findAllForAccount(admin(), { bogus: 'x' })).rejects.toThrow(BadRequestException);
    });

    it('findForAccountWithOptions caps the limit and keeps the account scope', async () => {
      const me = guest();
      bookings.findAll.mockResolvedValue([]);
      await service.findForAccountWithOptions(me, loose({ limit: 1000, activeOnly: true, roomNumber: '1', guestKeywords: 'a', sortBy: 'endTime', sortOrder: 'asc' }));
      const options = bookings.findAll.mock.calls[0][0];
      expect(options.limit).toBe(C.AGENT_BOOKINGS_MAX_LIMIT);
      expect(options.where.guestId).toBe(me.id);
      expect(options.order).toEqual([['endTime', 'ASC']]);
    });

    it('getListFilterMeta wraps the filters', () => {
      expect(service.getListFilterMeta()).toMatchObject({ success: true, data: expect.any(Object) });
    });
  });

  describe('findByIdForAccount', () => {
    const booking = { get: () => ({ id: 1 }) };

    it('adds the total cost for an admin or owner', async () => {
      bookings.findOne.mockResolvedValue(booking);
      costs.findByBookingId.mockResolvedValue({
        data: [
          { amount: '1.5', currency: 'usd' },
          { amount: '2', currency: 'usd' },
        ],
      });
      await expect(service.findByIdForAccount(1, owner())).resolves.toMatchObject({ data: { id: 1, totalCost: 3.5, currency: 'usd' } });
    });

    it('does not show costs to staff or guests', async () => {
      bookings.findOne.mockResolvedValue(booking);
      const res = await service.findByIdForAccount(1, guest());
      expect(res.data).not.toHaveProperty('totalCost');
      expect(costs.findByBookingId).not.toHaveBeenCalled();
    });

    it('throws NotFound for a booking outside the account scope', async () => {
      bookings.findOne.mockResolvedValue(null);
      await expect(service.findByIdForAccount(1, guest())).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateForAccount', () => {
    let booking: any;
    beforeEach(() => {
      booking = row({ id: 1, startTime: new Date(2026, 0, 1, 14), endTime: new Date(2026, 0, 3, 11), roomNumber: '101', status: BookingStatus.CONFIRMED, hotel });
      booking.changed = jest.fn(() => false);
      bookings.findOne.mockResolvedValue(booking);
      jest.spyOn(BookingRoom, 'findAll').mockResolvedValue([]);
    });

    it('updates the dates at the hotel times and retypes a free-text room number', async () => {
      const res = await service.updateForAccount(1, loose({ startDate: '2026-02-01', endDate: '2026-02-02', roomNumber: ' 9 ' }), staff());
      expect(res).toMatchObject({ success: true, data: { roomNumber: '9', startTime: new Date(2026, 1, 1, 14), endTime: new Date(2026, 1, 2, 11) } });
      expect(booking.save).toHaveBeenCalled();
    });

    it('moves the held rooms when the dates move', async () => {
      booking.changed = jest.fn(() => true);
      jest.spyOn(BookingRoom, 'findAll').mockResolvedValue(loose([{ room: { roomTypeId: 5 } }]));
      await service.updateForAccount(1, loose({ endDate: '2026-01-04' }), staff());
      expect(inventory.restoreInventoryForBookings).toHaveBeenCalledWith([1], expect.anything());
      expect(inventory.reserveInventoryOrFail).toHaveBeenCalledWith(5, expect.any(Array), 1, expect.anything());
    });

    it('re-syncs a PMS booking room when its dates move', async () => {
      booking.changed = jest.fn(() => true);
      booking.externalId = 'pms-1';
      jest.spyOn(Room, 'findOne').mockResolvedValue(null);
      await service.updateForAccount(1, loose({ endDate: '2026-01-04' }), staff());
      expect(inventory.restoreInventoryForBookings).toHaveBeenCalled();
      expect(inventory.reserveInventoryOrFail).not.toHaveBeenCalled();
    });

    it('releases the inventory when cancelling', async () => {
      await service.updateForAccount(1, loose({ status: BookingStatus.CANCELLED }), staff());
      expect(inventory.restoreInventoryForBookings).toHaveBeenCalledWith([1], expect.anything());
      expect(BookingRoom.destroy).toHaveBeenCalled();
      expect(booking.status).toBe(BookingStatus.CANCELLED);
    });

    it('refuses to retype the room number of an inventory booking', async () => {
      jest.spyOn(BookingRoom, 'count').mockResolvedValue(loose(1));
      await expect(service.updateForAccount(1, loose({ roomNumber: '999' }), staff())).rejects.toThrow(
        new BadRequestException("This booking's rooms come from inventory, so its room number cannot be typed in; change its dates or cancel it instead"),
      );
    });

    it('accepts the same room number on an inventory booking', async () => {
      jest.spyOn(BookingRoom, 'count').mockResolvedValue(loose(1));
      await expect(service.updateForAccount(1, loose({ roomNumber: '101' }), staff())).resolves.toMatchObject({ success: true });
    });

    it('refuses to reinstate a cancelled booking', async () => {
      booking.status = BookingStatus.CANCELLED;
      await expect(service.updateForAccount(1, loose({ status: BookingStatus.CONFIRMED }), staff())).rejects.toThrow(
        new BadRequestException('A cancelled booking cannot be reinstated; create a new booking instead'),
      );
    });

    it('refuses check-out on or before check-in', async () => {
      await expect(service.updateForAccount(1, loose({ endDate: '2025-12-31' }), staff())).rejects.toThrow(new BadRequestException('Check-out must be after check-in'));
    });

    it('throws NotFound for a booking outside the account scope', async () => {
      bookings.findOne.mockResolvedValue(null);
      await expect(service.updateForAccount(1, loose({}), guest())).rejects.toThrow(NotFoundException);
    });

    // Known problem (test/README.md): a guest can change their own booking. Drop `.failing` once fixed.
    it.failing('refuses a guest changing their own booking', async () => {
      await expect(service.updateForAccount(1, loose({ endDate: '2026-01-10' }), guest())).rejects.toThrow(ForbiddenException);
      expect(booking.save).not.toHaveBeenCalled();
    });
  });

  describe('deleteBooking', () => {
    const models: any[] = [Request, Message, Cost, Chat];
    let transaction: any;

    beforeEach(() => {
      transaction = { commit: jest.fn(), rollback: jest.fn() };
      db.transaction.mockResolvedValue(transaction);
      for (const model of models) jest.spyOn(model, 'destroy').mockResolvedValue(0);
      jest.spyOn(Chat, 'findAll').mockResolvedValue(loose([{ id: 4 }]));
      bookings.findAll.mockResolvedValue([{ id: 1 }]);
    });

    it('releases inventory, removes everything under the bookings and commits its own transaction', async () => {
      await service.deleteBooking({ id: 1 });
      expect(inventory.restoreInventoryForBookings).toHaveBeenCalledWith([1], transaction);
      for (const model of [BookingRoom, ...models]) expect(model.destroy).toHaveBeenCalled();
      expect(bookings.destroy).toHaveBeenCalledWith({ where: { id: 1 }, force: false, transaction });
      expect(transaction.commit).toHaveBeenCalled();
    });

    it('uses the caller transaction and leaves committing to it', async () => {
      const outer: any = { commit: jest.fn() };
      await service.deleteBooking({ hotelId: 1 }, outer, true);
      expect(db.transaction).not.toHaveBeenCalled();
      expect(outer.commit).not.toHaveBeenCalled();
      expect(bookings.destroy).toHaveBeenCalledWith({ where: { hotelId: 1 }, force: true, transaction: outer });
    });

    it('rolls back its own transaction on failure', async () => {
      inventory.restoreInventoryForBookings.mockRejectedValue(new Error('x'));
      await expect(service.deleteBooking({ id: 1 })).rejects.toThrow('x');
      expect(transaction.rollback).toHaveBeenCalled();
    });

    it('throws BadRequest without a database connection', async () => {
      bookings.sequelize = null;
      await expect(service.deleteBooking({ id: 1 })).rejects.toThrow(new BadRequestException('Database connection is unavailable'));
    });

    it('deleteForAccount deletes a booking in scope', async () => {
      bookings.findOne.mockResolvedValue({ id: 1 });
      await expect(service.deleteForAccount(1, admin())).resolves.toMatchObject({ success: true });
      expect(bookings.destroy).toHaveBeenCalled();
    });

    it('deleteForAccount throws NotFound outside the account scope', async () => {
      bookings.findOne.mockResolvedValue(null);
      await expect(service.deleteForAccount(1, guest())).rejects.toThrow(NotFoundException);
      expect(bookings.destroy).not.toHaveBeenCalled();
    });

    // Known problem (test/README.md): a guest can delete their own booking. Drop `.failing` once fixed.
    it.failing('deleteForAccount refuses a guest deleting their own booking', async () => {
      bookings.findOne.mockResolvedValue({ id: 1 });
      await expect(service.deleteForAccount(1, guest())).rejects.toThrow(ForbiddenException);
      expect(bookings.destroy).not.toHaveBeenCalled();
    });
  });
});
