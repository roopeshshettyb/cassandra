import { Inject, Injectable, ForbiddenException, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { BOOKINGS_REPOSITORY } from './bookings.repository';
import { Booking } from './bookings.model';
import { BookingRoom } from './booking-rooms.model';
import { InventoryService } from '../rooms/inventory.service';
import { RoomType } from '../rooms/room-types.model';
import { Room } from '../rooms/rooms.model';
import { CreateBookingDto, UpdateBookingDto, BookingExternalUpsertPayload } from './bookings.dto';
import { BookingQueryOptions } from './bookings.query';
import { Account, AccountRole } from '../accounts/accounts.model';
import { AccountsService } from '../accounts/accounts.service';
import { AuthService } from '../auth/auth.service';
import { HotelsService } from '../hotels/hotels.service';
import { Hotel } from '../hotels/hotels.model';
import { HotelBrand } from '../hotels/brands.model';
import { MailerService } from '../mailer/mailer.service';
import { BookingStatus, ConstantsService, DEFAULT_AVAILABILITY_ROOMS, DEFAULT_BOOKING_STATUS, DEFAULT_CHECK_IN_TIME, DEFAULT_CHECK_OUT_TIME } from '../common/constants/constants.service';
import { AwsService } from '../common/aws/aws.service';
import { DocumentExtractionService } from './document-extraction.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Op, literal, Sequelize, Transaction, UniqueConstraintError } from 'sequelize';
import { Chat } from '../chat/chat.model';
import { Request } from '../requests/requests.model';
import { Message } from '../messages/message.model';
import { Cost } from '../costs/costs.model';
import { forwardRef } from '@nestjs/common';
import { CostsService } from '../costs/costs.service';
import { randomUUID } from 'crypto';


/** A room this booking holds, as findAvailableRooms returns it. */
interface HeldRoom {
  id: number;
  roomNumber: string;
}

/** The nights a stay consumes, plus the dates its holds are stored with. */
interface Stay {
  nights: string[];
  checkIn: string;
  checkOut: string;
}
@Injectable()
export class BookingsService {
  constructor(
    @Inject(BOOKINGS_REPOSITORY) private readonly bookingsRepository: typeof Booking,
    private readonly accountsService: AccountsService,
    private readonly authService: AuthService,
    @Inject(forwardRef(() => HotelsService)) private readonly hotelsService: HotelsService,
    private readonly mailerService: MailerService,
    private readonly constantsService: ConstantsService,
    private readonly awsService: AwsService,
    private readonly documentExtractionService: DocumentExtractionService,
    @Inject(forwardRef(() => CostsService)) private readonly costsService: CostsService,
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => InventoryService)) private readonly inventoryService: InventoryService,
  ) {}

  private isWithinStayAttr(): [any, string] {
    return [literal(`CASE WHEN "start_time" IS NOT NULL AND "end_time" IS NOT NULL AND NOW() >= "start_time" AND NOW() <= "end_time" THEN true ELSE false END`), 'isWithinStay'];
  }

  private parseDateTime(dateStr: string, timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, hours, minutes, 0, 0);
  }

  private async ensureCanCreateForHotel(hotelId: number, currentAccount: Account): Promise<Hotel> {
    const hotel = await this.hotelsService.findByIdForAccount(hotelId, currentAccount);
    if (currentAccount.role !== AccountRole.ADMIN && currentAccount.role !== AccountRole.HOTEL_OWNER && currentAccount.role !== AccountRole.HOTEL_STAFF) {
      throw new ForbiddenException();
    }
    return hotel;
  }

  async createBooking(dto: CreateBookingDto, currentAccount: Account) {
    const hotel = await this.ensureCanCreateForHotel(dto.hotelId, currentAccount);

    const startDate = dto.startDate.trim();
    const endDate = dto.endDate.trim();
    if (endDate < startDate) {
      throw new BadRequestException('endDate must be on or after startDate');
    }

    const checkInTime = hotel.checkInTime || DEFAULT_CHECK_IN_TIME;
    const checkOutTime = hotel.checkOutTime || DEFAULT_CHECK_OUT_TIME;

    if (!dto.guestEmail?.trim()) {
      throw new BadRequestException('Guest email is required');
    }

    const guestAttributes: any = {
      name: dto.guestName,
      phone: dto.guestPhone?.trim() || undefined,
      role: AccountRole.GUEST,
    };
    const { account: guest } = await this.accountsService.findOrCreateByEmail(dto.guestEmail, guestAttributes);

    const startTime = this.parseDateTime(startDate, checkInTime);
    const endTime = this.parseDateTime(endDate, checkOutTime);

    const booking = dto.roomTypeId
      ? await this.createWithInventory(dto, hotel, guest.id, startTime, endTime)
      : await this.bookingsRepository.create({
          guestId: guest.id,
          hotelId: hotel.id,
          startTime,
          endTime,
          roomNumber: dto.roomNumber?.trim() || undefined,
          status: dto.status ?? DEFAULT_BOOKING_STATUS,
        });

    if (dto.sendInviteImmediately === true) {
      await this.sendInviteEmailForBooking(booking, guest, hotel, endTime);
    }

    if (dto.reservationDocumentKey?.trim()) {
      this.validateReservationDocumentKey(dto.reservationDocumentKey.trim());
      const prefix = this.constantsService.private.AWS_S3_KEY_PREFIX || '';
      const permanentKey = `${prefix}bookings/${booking.id}/${Date.now()}-doc${dto.reservationDocumentKey.endsWith('.pdf') ? '.pdf' : '.png'}`;
      await this.awsService.copyObject(dto.reservationDocumentKey.trim(), permanentKey, false);
      booking.reservationDocumentS3Key = permanentKey;
      await booking.save();
      await this.awsService.deleteObject(dto.reservationDocumentKey.trim(), false);
    }

    // Emit notification for new booking (fail silently)
    this.notificationsService.notify({
      eventType: 'NEW_BOOKING',
      booking,
      hotel,
      guest,
      actor: currentAccount,
    });

    return {
      success: true,
      message: 'Booking created',
      data: booking,
    };
  }

  /** The nights a stay consumes, alongside the date strings the holds are stored with. */
  private stayFor(startTime: Date, endTime: Date): Stay {
    return {
      nights: this.inventoryService.nightsBetween(startTime, endTime),
      checkIn: this.inventoryService.toDateString(startTime),
      checkOut: this.inventoryService.toDateString(endTime),
    };
  }

  /**
   * Hand a booking's nights back and drop the holds that named them.
   *
   * Order matters: releaseForBookings works out what to return by reading the live
   * booking_rooms rows, so they have to still be there when it runs. Removing them
   * in the same transaction is also what stops a repeat from refunding twice.
   */
  private async releaseHolds(bookingId: number, transaction: Transaction): Promise<void> {
    await this.inventoryService.releaseForBookings([bookingId], transaction);
    await BookingRoom.destroy({ where: { bookingId }, transaction, force: true });
  }

  /**
   * Take `count` rooms of a type off the market for a stay, or throw.
   *
   * Opening the nights first means a date nobody has booked before reads as unsold
   * rather than as sold out. The room lookup is the second gate: inventory can say
   * yes while no physical room is actually free, which means the counts have
   * drifted from the rooms table — failing here rolls the reservation back.
   */
  private async reserveAndPickRooms(
    hotelId: number,
    roomTypeId: number,
    count: number,
    stay: Stay,
    transaction: Transaction,
  ): Promise<HeldRoom[]> {
    await this.inventoryService.ensureNights(roomTypeId, stay.nights, transaction);
    await this.inventoryService.reserve(roomTypeId, stay.nights, count, transaction);

    const rooms = await this.inventoryService.findAvailableRooms(hotelId, roomTypeId, stay.checkIn, stay.checkOut, count, transaction);
    if (rooms.length < count) {
      throw new ConflictException('Not enough rooms available for the selected dates');
    }
    return rooms;
  }

  /** Record which rooms a booking holds, and return the room number it should display. */
  private async writeHolds(bookingId: number, rooms: HeldRoom[], stay: Stay, transaction: Transaction): Promise<string> {
    const rows: any = rooms.map((room) => ({ bookingId, roomId: room.id, checkIn: stay.checkIn, checkOut: stay.checkOut }));
    await BookingRoom.bulkCreate(rows, { transaction });
    return rooms.map((room) => room.roomNumber).join(', ');
  }

  /**
   * Book against dated inventory instead of a free-text room number.
   *
   * Everything below happens in one transaction: if the rooms cannot be held,
   * or two guests race for the last one, nothing is written — no orphaned
   * booking, no inventory held by a booking that was never created.
   */
  private async createWithInventory(
    dto: CreateBookingDto,
    hotel: Hotel,
    guestId: number,
    startTime: Date,
    endTime: Date,
  ): Promise<Booking> {
    // Nights are only handed back when a booking moves *into* cancelled, and a
    // cancelled booking cannot move anywhere — so one born cancelled would hold
    // its rooms with no way to release them.
    if (dto.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('A booking cannot be created as cancelled');
    }
    const stay = this.stayFor(startTime, endTime);
    if (stay.nights.length === 0) {
      throw new BadRequestException('Check-out must be after check-in to reserve a room');
    }
    const roomsWanted = dto.rooms ?? DEFAULT_AVAILABILITY_ROOMS;
    const sequelize = this.bookingsRepository.sequelize;
    if (!sequelize) {
      throw new BadRequestException('Database connection is unavailable');
    }

    // roomTypeId arrives from the request body independently of the hotel, and
    // room_inventory carries no hotel_id of its own — so without this check a
    // member of one hotel could consume another hotel's inventory. Not found
    // rather than forbidden, so an outsider learns nothing about what exists.
    const roomType = await RoomType.findByPk(dto.roomTypeId!);
    if (!roomType || roomType.hotelId !== hotel.id) {
      throw new NotFoundException();
    }

    return sequelize.transaction(async (transaction) => {
      const rooms = await this.reserveAndPickRooms(hotel.id, dto.roomTypeId!, roomsWanted, stay, transaction);

      const booking = await this.bookingsRepository.create(
        {
          guestId,
          hotelId: hotel.id,
          startTime,
          endTime,
          roomNumber: rooms.map((room) => room.roomNumber).join(', '),
          status: dto.status ?? DEFAULT_BOOKING_STATUS,
        },
        { transaction },
      );

      await this.writeHolds(booking.id, rooms, stay, transaction);

      return booking;
    });
  }


  async findByExternalId(hotelId: number, externalId: string): Promise<Booking | null> {
    return this.bookingsRepository.findOne({ where: { hotelId, externalId } });
  }

  // Called only from the integrations webhook path (hotelId is already trusted,
  // resolved from the integration token — never client-supplied here). Upserts by
  // (hotelId, externalId): same externalId twice updates the same row instead of
  // creating a duplicate.
  //
  // find-then-create isn't atomic, and PMS webhooks realistically deliver the same
  // externalId concurrently (retries, duplicate delivery) — two requests can both
  // find nothing and both try to create (same race applies to the guest-email
  // lookup below). Retrying once on a unique-constraint conflict re-reads what the
  // winning request just created, instead of surfacing a 500 to the loser.
  // Returns `created` so the webhook layer can answer 201 on insert and 200 on
  // update — PMS vendors distinguish the two by status code.
  async upsertByExternalId(
    hotelId: number,
    payload: BookingExternalUpsertPayload,
    isRetry = false,
  ): Promise<{ record: Booking; created: boolean }> {
    try {
      const startDate = payload.startDate.trim();
      const endDate = payload.endDate.trim();
      if (endDate < startDate) {
        throw new BadRequestException('endDate must be on or after startDate');
      }

      const hotel = await this.hotelsService.findById(hotelId);
      const checkInTime = hotel.checkInTime || DEFAULT_CHECK_IN_TIME;
      const checkOutTime = hotel.checkOutTime || DEFAULT_CHECK_OUT_TIME;

      const guestAttributes: any = {
        name: payload.guestName,
        phone: payload.guestPhone?.trim() || undefined,
        role: AccountRole.GUEST,
      };
      const { account: guest } = await this.accountsService.findOrCreateByEmail(payload.guestEmail, guestAttributes);

      const startTime = this.parseDateTime(startDate, checkInTime);
      const endTime = this.parseDateTime(endDate, checkOutTime);
      const roomNumber = payload.roomNumber?.trim();

      const existing = await this.findByExternalId(hotelId, payload.externalId);
      if (existing) {
        existing.startTime = startTime;
        existing.endTime = endTime;
        existing.guestId = guest.id;
        if (roomNumber) existing.roomNumber = roomNumber;
        await existing.save();
        await this.syncExternalInventory(existing);
        return { record: existing, created: false };
      }

      const record = await this.bookingsRepository.create({
        hotelId,
        guestId: guest.id,
        startTime,
        endTime,
        roomNumber: roomNumber || undefined,
        externalId: payload.externalId,
      });
      await this.syncExternalInventory(record);
      return { record, created: true };
    } catch (err) {
      if (!isRetry && err instanceof UniqueConstraintError) {
        return this.upsertByExternalId(hotelId, payload, true);
      }
      throw err;
    }
  }

  /** Return presigned PUT URL and key for client-side reservation document upload. Key is prefix + temp/ + uuid + ext. */
  async getReservationDocumentUploadUrl(account: Account, contentType?: string, filename?: string) {
    const prefix = this.constantsService.private.AWS_S3_KEY_PREFIX || '';
    const ext = contentType === 'application/pdf' ? '.pdf' : '.png';
    const key = `${prefix}temp/${randomUUID()}${ext}`;
    const expiry = this.constantsService.private.DOC_UPLOAD_URL_EXPIRY_SECONDS;
    const uploadUrl = await this.awsService.getPresignedPutUrl(key, contentType || undefined, expiry, false);
    return { success: true, message: null, data: { uploadUrl, key } };
  }

  /** Key must start with prefix and be under prefix + "temp/" for security. */
  private validateReservationDocumentKey(key: string): void {
    const prefix = this.constantsService.private.AWS_S3_KEY_PREFIX || '';
    const tempPrefix = `${prefix}temp/`;
    if (!key || !key.startsWith(tempPrefix)) {
      throw new BadRequestException('Invalid reservation document key');
    }
  }

  async extractFromReservationDocumentByKey(key: string, account: Account) {
    this.validateReservationDocumentKey(key);
    const expiry = this.constantsService.private.DOC_VIEW_URL_EXPIRY_SECONDS;
    const signedUrl = await this.awsService.getSignedUrl(key, expiry, false);
    const isPdf = key.endsWith('.pdf');
    const extracted = await this.documentExtractionService.extractFromDocumentUrl(signedUrl, isPdf);
    return { success: true, message: null, data: extracted };
  }

  async createFromReservationDocumentByKey(key: string, account: Account) {
    this.validateReservationDocumentKey(key);
    const expiry = this.constantsService.private.DOC_VIEW_URL_EXPIRY_SECONDS;
    const signedUrl = await this.awsService.getSignedUrl(key, expiry, false);
    const isPdf = key.endsWith('.pdf');
    let extracted;
    try {
      extracted = await this.documentExtractionService.extractFromDocumentUrl(signedUrl, isPdf);
    } catch (err: any) {
      const message = err?.message || 'Could not extract booking details from reservation document';
      throw new BadRequestException(message);
    }

    const missing: string[] = [];
    if (!extracted.startDate) missing.push('startDate');
    if (!extracted.endDate) missing.push('endDate');
    if (!extracted.guestEmail) missing.push('guestEmail');

    let hotelId: number | null = null;
    if (extracted.hotelName) {
      const { data: hotels } = await this.hotelsService.findAllForAccount(account);
      const nameLower = extracted.hotelName.trim().toLowerCase();
      let matchCount = 0;
      let matchedId: number | null = null;
      for (let i = 0; i < hotels.length; i++) {
        const h: any = hotels[i];
        if (h.name && nameLower && h.name.toLowerCase().includes(nameLower)) {
          matchCount++;
          matchedId = h.id;
        }
      }
      if (matchCount === 1) hotelId = matchedId;
      else if (matchCount > 1) {
        throw new BadRequestException('Multiple hotels match the reservation document. Please create the booking from the form and select the hotel.');
      }
    }
    if (!hotelId) missing.push('hotel (could not match hotel name from reservation document)');

    if (missing.length > 0) {
      throw new BadRequestException(
        `Could not create booking: missing ${missing.join(', ')}. Please ensure the reservation document contains all required details or create the booking from the form.`,
      );
    }

    const dto: CreateBookingDto = {
      startDate: extracted.startDate!,
      endDate: extracted.endDate!,
      guestEmail: extracted.guestEmail!,
      hotelId,
      sendInviteImmediately: false,
      ...(extracted.guestName && { guestName: extracted.guestName }),
      ...(extracted.guestPhone && { guestPhone: extracted.guestPhone }),
      ...(extracted.roomNumber && { roomNumber: extracted.roomNumber }),
    };

    const result = await this.createBooking(dto, account);
    const booking: any = result.data;
    if (booking?.id) {
      const prefix = this.constantsService.private.AWS_S3_KEY_PREFIX || '';
      const permanentKey = `${prefix}bookings/${booking.id}/${Date.now()}-doc${key.endsWith('.pdf') ? '.pdf' : '.png'}`;
      await this.awsService.copyObject(key, permanentKey, false);
      booking.reservationDocumentS3Key = permanentKey;
      await booking.save();
      await this.awsService.deleteObject(key, false);
    }
    return result;
  }

  async getReservationDocumentViewUrl(bookingId: number, account: Account) {
    const booking = await this.findByIdForAccount(bookingId, account);
    const data: any = booking.data;
    if (!data?.reservationDocumentS3Key) {
      throw new NotFoundException();
    }
    const expiry = this.constantsService.private.DOC_VIEW_URL_EXPIRY_SECONDS;
    const url = await this.awsService.getSignedUrl(data.reservationDocumentS3Key, expiry, false);
    return { success: true, message: null, data: { url } };
  }

  private async sendBookingConfirmationEmail(toEmail: string, guestName: string | null, hotel: Hotel, inviteUrl: string): Promise<void> {
    if (!toEmail) {
      return;
    }

    const pub = this.constantsService.public;
    const appName = pub.APP_NAME;
    const subject = `Your booking is confirmed - open ${appName} to help with your stay`;

    const greeting = guestName ? `Hi ${guestName},` : 'Hi,';
    const cta = `Start talking with ${appName} by clicking here`;
    const text = `${greeting}\n\nYour booking at ${hotel.name} is confirmed.\n\n${cta}\n\n${inviteUrl}`;
    const contentHtml = `<p>${greeting}</p><p>Your booking at <strong>${hotel.name}</strong> is confirmed.</p><p>Start talking with ${appName} by clicking <a href="${inviteUrl}">here</a>.</p>`;
    const html = this.mailerService.buildBaseEmailHtml(contentHtml);

    await this.mailerService.sendMail({
      to: toEmail,
      subject,
      text,
      html,
    });
  }

  /**
   * Called by cron: send invite email for bookings that have reached check-in time and have not been sent yet.
   */
  async sendPendingInviteEmails(): Promise<void> {
    const now = new Date();
    const bookings = await this.bookingsRepository.findAll({
      where: {
        inviteEmailSentAt: null,
        startTime: { [Op.lte]: now },
        endTime: { [Op.gte]: now },
      },
      include: [
        { model: Hotel, as: 'hotel' },
        { model: Account, as: 'guest', attributes: ['id', 'email', 'name'] },
      ],
    });

    for (let i = 0; i < bookings.length; i++) {
      const row: any = bookings[i];
      const guest: any = row.guest;
      const hotel: any = row.hotel;
      if (!guest?.email || !hotel) {
        continue;
      }
      try {
        await this.sendInviteEmailForBooking(row, guest, hotel, row.endTime as Date);
      } catch {
        // Skip this booking; one failure must not stop the rest
      }
    }
  }

  /**
   * Send invite email for a booking and mark inviteEmailSentAt. Used on create (send immediately) and by cron.
   */
  private async sendInviteEmailForBooking(booking: any, guest: Account, hotel: Hotel, endTime: Date): Promise<void> {
    const inviteExpiresAt = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
    const inviteToken = await this.authService.generateInviteToken(
      guest,
      { bookingId: booking.id, hotelId: hotel.id, type: 'guest' },
      inviteExpiresAt,
    );
    const frontendUrl = this.constantsService.private.FRONTEND_URL;
    const redirectPath = `/bookings/${booking.id}`;
    const inviteUrl = `${frontendUrl}/invite?token=${encodeURIComponent(inviteToken)}&redirectPath=${encodeURIComponent(redirectPath)}`;

    await this.sendBookingConfirmationEmail(guest.email, guest.name, hotel, inviteUrl);

    booking.inviteEmailSentAt = new Date();
    await booking.save();
  }

  private async getWhereForAccount(currentAccount: Account): Promise<{ [key: string]: any } | null> {
    if (currentAccount.role === AccountRole.ADMIN) {
      return null;
    }
    if (currentAccount.role === AccountRole.GUEST) {
      return { guestId: currentAccount.id };
    }
    if (currentAccount.role === AccountRole.HOTEL_OWNER || currentAccount.role === AccountRole.HOTEL_STAFF) {
      const { data: hotels } = await this.hotelsService.findAllForAccount(currentAccount);
      const hotelIds = hotels.map((h) => h.id);
      if (hotelIds.length === 0) {
        return { hotelId: -1 };
      }
      return { hotelId: { [Op.in]: hotelIds } };
    }
    return { id: -1 };
  }

  async findActiveForGuest(currentAccount: Account) {
    if (currentAccount.role !== AccountRole.GUEST) {
      throw new ForbiddenException();
    }
    const now = new Date();
    const booking = await this.bookingsRepository.findOne({
      where: {
        guestId: currentAccount.id,
        startTime: { [Op.lte]: now },
        endTime: { [Op.gte]: now },
      },
      order: [['id', 'DESC']],
    });
    return { success: true, message: null, data: booking };
  }

  async findAllForAccount(currentAccount: Account) {
    const includeHotel = { model: Hotel, as: 'hotel', attributes: ['id', 'name', 'address', 'logoUrl', 'themeConfig'], include: [{ model: HotelBrand, as: 'brand' }] };
    const includeGuest = { model: Account, as: 'guest', attributes: ['id', 'name', 'email'] };
    const where = await this.getWhereForAccount(currentAccount);
    const options: any = {
      include: [includeHotel, includeGuest],
      order: [['startTime', 'DESC']],
      attributes: { include: [this.isWithinStayAttr()] },
    };
    if (where) {
      options.where = where;
    }
    const bookings = await this.bookingsRepository.findAll(options);
    return { success: true, message: null, data: bookings };
  }

  async findForAccountWithOptions(currentAccount: Account, options?: BookingQueryOptions) {
    const includeHotel = { model: Hotel, as: 'hotel', attributes: ['id', 'name', 'address', 'logoUrl', 'themeConfig'], include: [{ model: HotelBrand, as: 'brand' }] };
    const includeGuest = { model: Account, as: 'guest', attributes: ['id', 'name', 'email'] };
    const whereForAccount = await this.getWhereForAccount(currentAccount);
    const where: any = {};
    if (whereForAccount) {
      Object.assign(where, whereForAccount);
    }

    if (options?.hotelId != null) {
      where.hotelId = options.hotelId;
    }

    if (options?.roomNumber) {
      where.roomNumber = { [Op.iLike]: `%${options.roomNumber}%` };
    }

    const now = new Date();
    if (options?.startAfter || options?.startBefore) {
      const startTimeFilter: any = {};
      if (options.startAfter) {
        startTimeFilter[Op.gte] = new Date(options.startAfter);
      }
      if (options.startBefore) {
        startTimeFilter[Op.lte] = new Date(options.startBefore);
      }
      if (options.activeOnly) {
        if (startTimeFilter[Op.lte] == null || new Date(startTimeFilter[Op.lte]) > now) {
          startTimeFilter[Op.lte] = now;
        }
        where.endTime = { [Op.gte]: now };
      }
      where.startTime = startTimeFilter;
    } else if (options?.activeOnly) {
      where.startTime = { [Op.lte]: now };
      where.endTime = { [Op.gte]: now };
    }

    if (options?.guestKeywords) {
      const pattern = `%${options.guestKeywords}%`;
      where[Op.or] = [
        { '$guest.name$': { [Op.iLike]: pattern } },
        { '$guest.email$': { [Op.iLike]: pattern } },
      ];
    }

    const sortBy = options?.sortBy ?? 'startTime';
    const sortOrder = options?.sortOrder === 'asc' ? 'ASC' : 'DESC';
    let orderField = 'startTime';
    if (sortBy === 'endTime') {
      orderField = 'endTime';
    } else if (sortBy === 'id') {
      orderField = 'id';
    }

    const queryOptions: any = {
      where,
      include: [includeHotel, includeGuest],
      order: [[orderField, sortOrder]],
      subQuery: false,
    };

    const agentLimits = this.constantsService.private;
    if (options?.limit != null) {
      queryOptions.limit = Math.min(Math.max(1, options.limit), agentLimits.AGENT_BOOKINGS_MAX_LIMIT);
    }

    const bookings = await this.bookingsRepository.findAll(queryOptions);
    return { success: true, message: null, data: bookings };
  }

  async findByIdForAccount(id: number, currentAccount: Account) {
    const where = await this.getWhereForAccount(currentAccount);
    const findWhere = where ? { ...where, id } : { id };
    const booking = await this.bookingsRepository.findOne({
      where: findWhere,
      include: [
        { model: Hotel, as: 'hotel', include: [{ model: HotelBrand, as: 'brand' }] },
        { model: Account, as: 'guest', attributes: ['id', 'email', 'name'] },
        {
          model: Request,
          as: 'requests',
          attributes: ['id', 'requestType', 'urgency', 'status', 'userNotes', 'staffNotes', 'createdAt'],
        },
      ],
      order: [
        [{ model: Request, as: 'requests' }, 'createdAt', 'DESC'],
        [{ model: Request, as: 'requests' }, 'urgency', 'DESC'],
      ],
      attributes: { include: [this.isWithinStayAttr()] },
    });

    if (!booking) {
      throw new NotFoundException();
    }

    const plain = booking.get({ plain: true }) as unknown as Record<string, unknown>;

    if (currentAccount.role === AccountRole.ADMIN || currentAccount.role === AccountRole.HOTEL_OWNER) {
      const costsResult = await this.costsService.findByBookingId(id);
      if (costsResult && costsResult.data) {
        const total = costsResult.data.reduce((sum, c) => sum + parseFloat(c.amount), 0);
        plain.totalCost = total;
        plain.currency = costsResult.data[0]?.currency || 'USD';
      }
    }

    return { success: true, message: null, data: plain };
  }

  async updateForAccount(id: number, dto: UpdateBookingDto, currentAccount: Account) {
    const where = await this.getWhereForAccount(currentAccount);
    const findWhere = where ? { ...where, id } : { id };
    const booking = await this.bookingsRepository.findOne({
      where: findWhere,
      include: [{ model: Hotel, as: 'hotel' }],
    });

    if (!booking) {
      throw new NotFoundException();
    }

    const hotel: any = (booking as any).hotel;
    const checkInTime = hotel?.checkInTime || DEFAULT_CHECK_IN_TIME;
    const checkOutTime = hotel?.checkOutTime || DEFAULT_CHECK_OUT_TIME;

    if (dto.startDate !== undefined) {
      booking.startTime = this.parseDateTime(dto.startDate.trim(), checkInTime);
    }
    if (dto.endDate !== undefined) {
      booking.endTime = this.parseDateTime(dto.endDate.trim(), checkOutTime);
    }
    // A booking that holds inventory takes its room number from the rooms it
    // actually holds, so a hand-typed one is ignored rather than written. Applying
    // it would leave booking.room_number naming one room while booking_rooms holds
    // another — the displayed room would be a room nobody has reserved.
    const holdsInventory = (await BookingRoom.count({ where: { bookingId: booking.id } })) > 0;
    if (dto.roomNumber !== undefined && !holdsInventory) {
      booking.roomNumber = dto.roomNumber.trim();
    }

    const wasCancelled = booking.status === BookingStatus.CANCELLED;
    if (dto.status !== undefined && dto.status !== booking.status) {
      // Reinstating would have to re-reserve the nights, and by now they may be
      // sold to someone else. Book again rather than silently overselling.
      if (wasCancelled) {
        throw new BadRequestException('A cancelled booking cannot be reinstated; create a new booking instead');
      }
      booking.status = dto.status;
    }

    if (booking.startTime >= booking.endTime) {
      throw new BadRequestException('Check-out must be after check-in');
    }

    const sequelize = this.bookingsRepository.sequelize;
    if (!sequelize) {
      throw new BadRequestException('Database connection is unavailable');
    }

    const isCancelling = booking.status === BookingStatus.CANCELLED && !wasCancelled;
    const datesMoved = booking.changed('startTime') || booking.changed('endTime');

    // A booking that holds inventory has to carry that hold with it when its dates
    // move. Saving the new dates alone would leave the old nights reserved for
    // nobody and the new ones free to be sold again underneath the guest.
    if (datesMoved && !isCancelling) {
      await this.moveInventoryHold(booking, sequelize);
    }

    if (!isCancelling) {
      await booking.save();
      return { success: true, message: 'Booking updated', data: booking };
    }

    await sequelize.transaction(async (transaction) => {
      await this.releaseHolds(booking.id, transaction);
      await booking.save({ transaction });
    });

    return { success: true, message: 'Booking updated', data: booking };
  }

  /**
   * Make a PMS-pushed booking consume the inventory it actually occupies.
   *
   * The PMS sends a room number rather than a room type, so the room is looked up
   * to find which type it belongs to. Without this the room is occupied in the
   * real world while `reserved` stays untouched, and we happily sell it again —
   * findAvailableRooms only avoids rooms that have a booking_rooms row.
   *
   * Written as release-then-re-hold so it is safe to run repeatedly: PMS webhooks
   * retry and redeliver, and an upsert that ran twice must not count the same
   * room twice. Runs unguarded on purpose — see InventoryService.reserveExternal.
   *
   * Anything it cannot map (no room number, or a number matching no room we know)
   * is not rejected: the reservation is still real and belongs in the system even
   * if we cannot attribute it to a room type. It holds nothing, though — and nor
   * does a cancelled booking — so whatever an earlier delivery held is released
   * before deciding whether to hold again.
   */
  private async syncExternalInventory(booking: Booking): Promise<void> {
    const sequelize = this.bookingsRepository.sequelize;
    if (!sequelize) {
      return;
    }
    const roomNumber = booking.roomNumber?.trim();
    const room = roomNumber ? await Room.findOne({ where: { hotelId: booking.hotelId, roomNumber } }) : null;
    const stay = this.stayFor(booking.startTime, booking.endTime);
    const holdsRoom = stay.nights.length > 0 && booking.status !== BookingStatus.CANCELLED;

    await sequelize.transaction(async (transaction) => {
      await this.releaseHolds(booking.id, transaction);
      if (!room || !holdsRoom) {
        return;
      }

      // Not reserveAndPickRooms: the PMS has already chosen the room, and its
      // booking is not a request we can turn down.
      await this.inventoryService.ensureNights(room.roomTypeId, stay.nights, transaction);
      await this.inventoryService.reserveExternal(room.roomTypeId, stay.nights, 1, transaction);

      await this.writeHolds(booking.id, [{ id: room.id, roomNumber: room.roomNumber }], stay, transaction);
    });
  }

  /**
   * Re-hold a booking's rooms over its new dates.
   *
   * The old nights are released first so a stay that merely shifts by a day is not
   * competing with itself for the nights it already owns. Deleting the holds in the
   * same transaction also frees its own physical rooms, so an unchanged room number
   * stays available to it. If the new dates cannot be covered, the ConflictException
   * rolls the whole thing back and the booking keeps the dates it had.
   */
  private async moveInventoryHold(booking: Booking, sequelize: Sequelize): Promise<void> {
    const held = await BookingRoom.findAll({
      where: { bookingId: booking.id },
      include: [{ model: Room, as: 'room' }],
    });
    // Nothing held means this booking was made against a free-text room number and
    // never touched inventory, so there is nothing to move.
    if (held.length === 0) {
      return;
    }

    const firstHeld: any = held[0];
    const roomTypeId = firstHeld.room?.roomTypeId;
    if (!roomTypeId) {
      return;
    }
    const roomsWanted = held.length;
    const stay = this.stayFor(booking.startTime, booking.endTime);
    if (stay.nights.length === 0) {
      throw new BadRequestException('Check-out must be after check-in');
    }

    await sequelize.transaction(async (transaction) => {
      await this.releaseHolds(booking.id, transaction);

      const rooms = await this.reserveAndPickRooms(booking.hotelId, roomTypeId, roomsWanted, stay, transaction);
      booking.roomNumber = await this.writeHolds(booking.id, rooms, stay, transaction);
      await booking.save({ transaction });
    });
  }

  async deleteBooking(where: any, transaction?: Transaction, force = false): Promise<void> {
    const sequelize = this.bookingsRepository.sequelize;
    if (!sequelize) {
      throw new BadRequestException('Database connection is unavailable');
    }

    let localTransaction: Transaction | null = null;
    let effectiveTransaction = transaction;
    if (!effectiveTransaction) {
      localTransaction = await sequelize.transaction();
      effectiveTransaction = localTransaction;
    }

    try {
      const bookings = await this.bookingsRepository.findAll({
        where,
        attributes: ['id'],
        paranoid: !force,
        transaction: effectiveTransaction,
      });

      const bookingIds: number[] = [];
      for (let i = 0; i < bookings.length; i++) {
        bookingIds.push(bookings[i].id);
      }

      if (bookingIds.length > 0) {
        // Hand the nights back before the holds go: releaseForBookings reads
        // booking_rooms to work out what this booking is holding.
        await this.inventoryService.releaseForBookings(bookingIds, effectiveTransaction as Transaction);

        await BookingRoom.destroy({
          where: { bookingId: { [Op.in]: bookingIds } },
          force,
          transaction: effectiveTransaction,
        });

        await Request.destroy({
          where: { bookingId: { [Op.in]: bookingIds } },
          force,
          transaction: effectiveTransaction,
        });

        const chats = await Chat.findAll({
          where: { bookingId: { [Op.in]: bookingIds } },
          attributes: ['id'],
          transaction: effectiveTransaction,
        });

        const chatIds: number[] = [];
        for (let i = 0; i < chats.length; i++) {
          chatIds.push(chats[i].id);
        }

        if (chatIds.length > 0) {
          await Message.destroy({
            where: { chatId: { [Op.in]: chatIds } },
            force,
            transaction: effectiveTransaction,
          });
          await Cost.destroy({
            where: { chatId: { [Op.in]: chatIds } },
            force,
            transaction: effectiveTransaction,
          });
          await Chat.destroy({
            where: { id: { [Op.in]: chatIds } },
            force,
            transaction: effectiveTransaction,
          });
        }

        await Cost.destroy({
          where: { bookingId: { [Op.in]: bookingIds } },
          force,
          transaction: effectiveTransaction,
        });
      }

      await this.bookingsRepository.destroy({
        where,
        force,
        transaction: effectiveTransaction,
      });

      if (localTransaction) {
        await localTransaction.commit();
      }
    } catch (error) {
      if (localTransaction) {
        await localTransaction.rollback();
      }
      throw error;
    }
  }

  async deleteForAccount(id: number, currentAccount: Account, force = false) {
    const where = await this.getWhereForAccount(currentAccount);
    const findWhere = where ? { ...where, id } : { id };
    const booking = await this.bookingsRepository.findOne({ where: findWhere });

    if (!booking) {
      throw new NotFoundException();
    }

    await this.deleteBooking({ id }, undefined, force);
    return { success: true, message: 'Booking deleted', data: null };
  }
}
