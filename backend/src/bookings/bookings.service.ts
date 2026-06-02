import { Inject, Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { BOOKINGS_REPOSITORY } from './bookings.repository';
import { Booking } from './bookings.model';
import { CreateBookingDto, UpdateBookingDto } from './bookings.dto';
import { BookingQueryOptions } from './bookings.query';
import { Account, AccountRole } from '../accounts/accounts.model';
import { AccountsService } from '../accounts/accounts.service';
import { AuthService } from '../auth/auth.service';
import { HotelsService } from '../hotels/hotels.service';
import { Hotel } from '../hotels/hotels.model';
import { HotelBrand } from '../hotels/brands.model';
import { MailerService } from '../mailer/mailer.service';
import { ConstantsService, DEFAULT_CHECK_IN_TIME, DEFAULT_CHECK_OUT_TIME } from '../common/constants/constants.service';
import { AwsService } from '../common/aws/aws.service';
import { DocumentExtractionService } from './document-extraction.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Op, literal, Transaction } from 'sequelize';
import { Chat } from '../chat/chat.model';
import { Request } from '../requests/requests.model';
import { Message } from '../messages/message.model';
import { Cost } from '../costs/costs.model';
import { forwardRef } from '@nestjs/common';
import { CostsService } from '../costs/costs.service';
import { randomUUID } from 'crypto';

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

    const normalizedEmail = dto.guestEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestException('Guest email is required');
    }

    let guest = await this.accountsService.findOne({
      where: { email: normalizedEmail },
    });

    if (!guest) {
      const uuid = `email:${normalizedEmail}`;
      guest = await this.accountsService.create({
        uuid,
        email: normalizedEmail,
        name: dto.guestName,
        phone: dto.guestPhone?.trim() || undefined,
        oauthMeta: {},
        role: AccountRole.GUEST,
      });
    }

    const startTime = this.parseDateTime(startDate, checkInTime);
    const endTime = this.parseDateTime(endDate, checkOutTime);

    const booking = await this.bookingsRepository.create({
      guestId: guest.id,
      hotelId: hotel.id,
      startTime,
      endTime,
      roomNumber: dto.roomNumber?.trim() || undefined,
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
    const cta = 'Start talking with Samantha by clicking here';
    const text = `${greeting}\n\nYour booking at ${hotel.name} is confirmed.\n\n${cta}\n\n${inviteUrl}`;
    const contentHtml = `<p>${greeting}</p><p>Your booking at <strong>${hotel.name}</strong> is confirmed.</p><p>Start talking with Samantha by clicking <a href="${inviteUrl}">here</a>.</p>`;
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
    if (dto.roomNumber !== undefined) {
      booking.roomNumber = dto.roomNumber.trim();
    }

    if (booking.startTime >= booking.endTime) {
      throw new BadRequestException('endDate must be after startDate');
    }

    await booking.save();
    return { success: true, message: 'Booking updated', data: booking };
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
