import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UniqueConstraintError } from 'sequelize';
import { BookingsService } from '../../../src/bookings/bookings.service';
import { BookingRoom } from '../../../src/bookings/booking-rooms.model';
import { Room } from '../../../src/rooms/rooms.model';
import { Request } from '../../../src/requests/requests.model';
import { Chat } from '../../../src/chat/chat.model';
import { Message } from '../../../src/messages/message.model';
import { Cost } from '../../../src/costs/costs.model';
import { BookingStatus } from '../../../src/common/constants/constants.service';
import { AccountRole } from '../../../src/accounts/accounts.model';
import { mock, constants, owner, staff, guest, row, sequelize, loose } from '../helpers';

describe('BookingsService', () => {
  let bookings: any, accountsService: any, hotelsService: any, mailer: any, aws: any, extraction: any, costs: any, notifications: any, inventory: any, db: any;
  let service: BookingsService;
  const C = constants.private;
  const hotel = { id: 1, name: 'Grand', checkInTime: '14:00', checkOutTime: '11:00' };
  const guestAccount = { id: 50, email: 'g@x', name: 'G' };
  const prefix = C.AWS_S3_KEY_PREFIX;

  beforeEach(() => {
    db = sequelize();
    bookings = mock({ sequelize: db, create: jest.fn(async (data: any) => row({ id: 99, ...data })) });
    accountsService = mock({ findOrCreateByEmail: jest.fn(async () => ({ account: guestAccount, created: true })) });
    hotelsService = mock({ findByIdForAccount: jest.fn(async () => hotel), findById: jest.fn(async () => hotel), findAllForAccount: jest.fn(async () => ({ data: [{ id: 1 }, { id: 2 }] })) });
    mailer = mock();
    aws = mock({ getSignedUrl: jest.fn(async () => 'https://signed') });
    extraction = mock();
    costs = mock();
    notifications = mock();
    inventory = mock({
      nightsBetween: jest.fn((a: Date, b: Date) => (b > a && b.toDateString() !== a.toDateString() ? ['2026-01-01'] : [])),
      toDateOnly: jest.fn((d: Date) => d.toISOString().slice(0, 10)),
    });
    service = new BookingsService(bookings, accountsService, mock(), hotelsService, mailer, constants, aws, extraction, costs, notifications, inventory);
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
  });

  describe('upsertByExternalId', () => {
    const payload: any = { externalId: 'pms-1', startDate: '2026-01-01', endDate: '2026-01-02', guestEmail: 'g@x', roomNumber: '101' };
    beforeEach(() => jest.spyOn(Room, 'findOne').mockResolvedValue(null));

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

    it('extracts fields from an uploaded document', async () => {
      extraction.extractFromDocumentUrl.mockResolvedValue({ startDate: '2026-01-01' });
      await expect(service.extractFromReservationDocumentByKey(key, staff())).resolves.toMatchObject({ data: { startDate: '2026-01-01' } });
      expect(extraction.extractFromDocumentUrl).toHaveBeenCalledWith('https://signed', true);
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
  });

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

  describe('scoping', () => {
    it('findAllForAccount matches nothing for staff without hotels', async () => {
      hotelsService.findAllForAccount.mockResolvedValue({ data: [] });
      bookings.findAll.mockResolvedValue([]);
      await service.findAllForAccount(owner(), {});
      expect(bookings.findAll.mock.calls[0][0].where.hotelId).toBe(-1);
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
  });

  describe('updateForAccount', () => {
    let booking: any;
    beforeEach(() => {
      booking = row({ id: 1, startTime: new Date(2026, 0, 1, 14), endTime: new Date(2026, 0, 3, 11), roomNumber: '101', status: BookingStatus.CONFIRMED, hotel });
      booking.changed = jest.fn(() => false);
      bookings.findOne.mockResolvedValue(booking);
    });

    it('refuses check-out on or before check-in', async () => {
      await expect(service.updateForAccount(1, loose({ endDate: '2025-12-31' }), staff())).rejects.toThrow(new BadRequestException('Check-out must be after check-in'));
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

    // Known problem (test/README.md): a guest can delete their own booking. Drop `.failing` once fixed.
    it.failing('deleteForAccount refuses a guest deleting their own booking', async () => {
      bookings.findOne.mockResolvedValue({ id: 1 });
      await expect(service.deleteForAccount(1, guest())).rejects.toThrow(ForbiddenException);
      expect(bookings.destroy).not.toHaveBeenCalled();
    });
  });
});
