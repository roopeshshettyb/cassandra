import { Inject, Injectable, ForbiddenException, NotFoundException, BadRequestException, forwardRef } from '@nestjs/common';
import { REQUESTS_REPOSITORY } from './requests.repository';
import { Request, RequestStatus } from './requests.model';
import { CreateRequestDto, UpdateRequestDto, RequestExternalUpsertPayload } from './requests.dto';
import { RequestQueryOptions } from './requests.query';
import { resolveListPaging } from '../common/dto/list-query.dto';
import { Account, AccountRole } from '../accounts/accounts.model';
import { BookingsService } from '../bookings/bookings.service';
import { HotelsService } from '../hotels/hotels.service';
import { Hotel } from '../hotels/hotels.model';
import { Booking } from '../bookings/bookings.model';
import { NotificationsService } from '../notifications/notifications.service';
import { ConstantsService } from '../common/constants/constants.service';
import { Op, literal, UniqueConstraintError } from 'sequelize';

@Injectable()
export class RequestsService {
  constructor(
    @Inject(REQUESTS_REPOSITORY) private readonly requestsRepository: typeof Request,
    @Inject(forwardRef(() => BookingsService)) private readonly bookingsService: BookingsService,
    private readonly hotelsService: HotelsService,
    private readonly notificationsService: NotificationsService,
    private readonly constantsService: ConstantsService,
  ) {}

  private get requestsConfig() {
    return this.constantsService.private.REQUESTS;
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

  /** Narrows the account scope by hotelId. Assigning over `where.hotelId` would drop it and leak other hotels. */
  private narrowHotelId(where: { [key: string]: any }, hotelId: number): void {
    where.hotelId = where.hotelId == null ? hotelId : { [Op.and]: [where.hotelId, { [Op.eq]: hotelId }] };
  }

  /** Applies a filter that may be a single value or a multi-select list. An empty list means "no filter". */
  private applyFilter(where: { [key: string]: any }, key: string, value: unknown): void {
    if (value == null) return;
    const values = Array.isArray(value) ? value : [value];
    if (values.length === 0) return;
    where[key] = values.length === 1 ? values[0] : { [Op.in]: values };
  }

  private async ensureCanCreate(dto: CreateRequestDto, currentAccount: Account): Promise<void> {
    if (currentAccount.role === AccountRole.ADMIN) {
      return;
    }
    if (currentAccount.role === AccountRole.GUEST) {
      if (dto.guestId !== currentAccount.id) {
        throw new ForbiddenException();
      }
      return;
    }
    if (currentAccount.role === AccountRole.HOTEL_OWNER || currentAccount.role === AccountRole.HOTEL_STAFF) {
      await this.hotelsService.findByIdForAccount(dto.hotelId, currentAccount);
      return;
    }
    throw new ForbiddenException();
  }

  async findAllForAccount(currentAccount: Account, options?: Pick<RequestQueryOptions, 'sortBy' | 'sortOrder'>) {
    const where = await this.getWhereForAccount(currentAccount);

    const findOptions: any = {
      order: this.buildRequestOrder(options),
      include: [
        { model: Hotel, as: 'hotel', attributes: ['id', 'name'] },
        { model: Account, as: 'guest', attributes: ['id', 'name', 'email'] },
        { model: Booking, as: 'booking', attributes: ['id'] },
      ],
    };

    if (where) {
      findOptions.where = where;
    }

    const requests = await this.requestsRepository.findAll(findOptions);

    return {
      success: true,
      message: null,
      data: requests,
    };
  }

  async findByIdForAccount(id: number, currentAccount: Account) {
    const where = await this.getWhereForAccount(currentAccount);
    const findWhere = where ? { ...where, id } : { id };
    const req = await this.requestsRepository.findOne({
      where: findWhere,
      include: [
        { model: Hotel, as: 'hotel', attributes: ['id', 'name'] },
        { model: Account, as: 'guest', attributes: ['id', 'name', 'email'] },
        { model: Booking, as: 'booking', attributes: ['id'] },
      ],
    });
    if (!req) {
      throw new NotFoundException();
    }
    return { success: true, message: null, data: req };
  }

  async create(dto: CreateRequestDto, currentAccount: Account) {
    const { data: booking } = await this.bookingsService.findByIdForAccount(dto.bookingId, currentAccount);
    if (booking.hotelId !== dto.hotelId || booking.guestId !== dto.guestId) {
      throw new BadRequestException('Booking does not match hotelId and guestId');
    }

    await this.ensureCanCreate(dto, currentAccount);

    const userNotes = dto.userNotes ?? [];
    const staffNotes = dto.staffNotes ?? [];

    const request = await this.requestsRepository.create({
      hotelId: dto.hotelId,
      guestId: dto.guestId,
      bookingId: dto.bookingId,
      requestType: dto.requestType,
      userNotes,
      staffNotes,
      data: dto.data ?? null,
      urgency: dto.urgency,
      chatId: dto.chatId ?? null,
    });

    // Emit notification for new request (fail silently)
    const hotel = await this.hotelsService.findById(dto.hotelId);
    this.notificationsService.notify({
      eventType: 'NEW_REQUEST',
      request,
      hotel,
      actor: currentAccount,
    });

    return {
      success: true,
      message: 'Request created',
      data: request,
    };
  }

  // Called only from the integrations webhook path (hotelId is already trusted,
  // resolved from the integration token). Upserts by (hotelId, externalId); the
  // guest is resolved from the booking, never supplied directly by the PMS payload.
  //
  // Retries once on a unique-constraint conflict — see BookingsService.upsertByExternalId
  // for why find-then-create needs this under concurrent identical-externalId delivery.
  async upsertByExternalId(
    hotelId: number,
    payload: RequestExternalUpsertPayload,
    isRetry = false,
  ): Promise<{ record: Request; created: boolean }> {
    try {
      const booking = await this.bookingsService.findByExternalId(hotelId, payload.bookingExternalId);
      if (!booking) {
        throw new BadRequestException(this.constantsService.private.INTEGRATIONS.ERROR_BOOKING_NOT_FOUND_FOR_REQUEST);
      }

      const existing = await this.requestsRepository.findOne({ where: { hotelId, externalId: payload.externalId } });
      if (existing) {
        existing.bookingId = booking.id;
        existing.guestId = booking.guestId;
        existing.requestType = payload.requestType;
        existing.urgency = payload.urgency;
        if (payload.status) existing.status = payload.status;
        if (payload.userNotes) existing.userNotes = payload.userNotes;
        await existing.save();
        return { record: existing, created: false };
      }

      const record = await this.requestsRepository.create({
        hotelId,
        guestId: booking.guestId,
        bookingId: booking.id,
        requestType: payload.requestType,
        urgency: payload.urgency,
        status: payload.status,
        userNotes: payload.userNotes ?? [],
        externalId: payload.externalId,
      });
      return { record, created: true };
    } catch (err) {
      if (!isRetry && err instanceof UniqueConstraintError) {
        return this.upsertByExternalId(hotelId, payload, true);
      }
      throw err;
    }
  }

  async update(id: number, dto: UpdateRequestDto, currentAccount: Account) {
    const where = await this.getWhereForAccount(currentAccount);
    const findWhere = where ? { ...where, id } : { id };
    const request = await this.requestsRepository.findOne({ where: findWhere });

    if (!request) {
      throw new NotFoundException();
    }

    // Only hotel staff/owner (or admin) can change request status or urgency:
    // a guest who could raise their own urgency would jump the queue.
    if (dto.status !== undefined || dto.urgency !== undefined) {
      const isStaffOrOwner =
        currentAccount.role === AccountRole.ADMIN ||
        currentAccount.role === AccountRole.HOTEL_OWNER ||
        currentAccount.role === AccountRole.HOTEL_STAFF;

      if (!isStaffOrOwner) {
        throw new ForbiddenException(this.requestsConfig.ERROR_STAFF_ONLY_FIELDS);
      }
    }

    await request.update(dto);

    // Emit notification for request update (fail silently)
    const hotel = await this.hotelsService.findById(request.hotelId);
    this.notificationsService.notify({
      eventType: 'REQUEST_UPDATED',
      request,
      hotel,
      actor: currentAccount,
    });

    return {
      success: true,
      message: this.requestsConfig.MSG_UPDATED,
      data: request,
    };
  }

  // `id` breaks ties on every sort: urgency has three distinct values and timestamps
  // collide, and without it LIMIT/OFFSET can repeat a row on one page and skip another.
  private buildRequestOrder(options?: RequestQueryOptions): any[] {
    const sortOrder = options?.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const sortBy = options?.sortBy ?? 'createdAt';
    const tieBreaker = ['id', sortOrder];
    if (sortBy === 'urgency') {
      return [[literal("CASE urgency WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 END"), sortOrder], tieBreaker];
    }
    if (sortBy === 'updatedAt') {
      return [['updatedAt', sortOrder], tieBreaker];
    }
    return [['createdAt', sortOrder], tieBreaker];
  }

  /** Caps a caller-supplied limit. No limit asked for means no limit applied. */
  private resolveRequestLimit(limit?: number): number | undefined {
    if (limit == null) return undefined;
    const agentLimits = this.constantsService.private;
    return Math.min(Math.max(1, limit), agentLimits.AGENT_REQUESTS_MAX_LIMIT);
  }

  async findForAccountWithOptions(currentAccount: Account, options?: RequestQueryOptions) {
    const whereForAccount = await this.getWhereForAccount(currentAccount);
    const where: any = {};
    if (whereForAccount) {
      Object.assign(where, whereForAccount);
    }

    if (options?.bookingId != null) {
      where.bookingId = options.bookingId;
    }

    if (options?.hotelId != null) {
      await this.hotelsService.findByIdForAccount(options.hotelId, currentAccount);
      this.narrowHotelId(where, options.hotelId);
    }

    this.applyFilter(where, 'status', options?.status);
    this.applyFilter(where, 'requestType', options?.requestType);
    this.applyFilter(where, 'urgency', options?.urgency);

    const findOptions: any = {
      where,
      order: this.buildRequestOrder(options),
      include: [
        { model: Hotel, as: 'hotel', attributes: ['id', 'name'] },
        { model: Account, as: 'guest', attributes: ['id', 'name', 'email'] },
        { model: Booking, as: 'booking', attributes: ['id'] },
      ],
    };

    const paging = resolveListPaging(options, this.constantsService.private);
    if (paging) {
      findOptions.limit = paging.limit;
      findOptions.offset = paging.offset;
    } else {
      const resolvedLimit = this.resolveRequestLimit(options?.limit);
      if (resolvedLimit != null) {
        findOptions.limit = resolvedLimit;
      }
    }

    const { rows, count } = await this.requestsRepository.findAndCountAll({ ...findOptions, distinct: true });

    return {
      success: true,
      message: null,
      data: rows,
      meta: {
        total: count,
        page: paging?.page ?? this.constantsService.private.LIST_PAGE_DEFAULT,
        pageSize: paging?.limit ?? rows.length,
      },
    };
  }

  async findByBookingId(bookingId: number, currentAccount: Account, options?: RequestQueryOptions) {
    return this.findForAccountWithOptions(currentAccount, { ...options, bookingId });
  }

  async appendMessage(id: number, message: string, currentAccount: Account) {
    if (currentAccount.role === AccountRole.GUEST) {
      return this.appendUserMessage(id, message, currentAccount);
    }
    return this.appendStaffMessage(id, message, currentAccount);
  }

  async appendUserMessage(id: number, message: string, currentAccount: Account) {
    const where = await this.getWhereForAccount(currentAccount);
    const findWhere = where ? { ...where, id } : { id };
    const request = await this.requestsRepository.findOne({ where: findWhere });

    if (!request) {
      throw new NotFoundException();
    }

    if (currentAccount.role !== AccountRole.ADMIN && request.guestId !== currentAccount.id) {
      throw new ForbiddenException();
    }

    const userNotes: any[] = Array.isArray(request.userNotes)
      ? JSON.parse(JSON.stringify(request.userNotes))
      : [];
    userNotes.push({ 
      text: message, 
      addedAt: new Date().toISOString(),
      accountId: currentAccount.id
    });
    await request.update({ userNotes });

    // Emit notification for new message (fail silently)
    const hotel = await this.hotelsService.findById(request.hotelId);
    const messagePreview = message.substring(0, 50);
    this.notificationsService.notify({
      eventType: 'NEW_MESSAGE',
      request,
      hotel,
      actor: currentAccount,
      messagePreview,
    });

    return {
      success: true,
      message: 'User message appended',
      data: request,
    };
  }

  async appendStaffMessage(id: number, message: string, currentAccount: Account) {
    const where = await this.getWhereForAccount(currentAccount);
    const findWhere = where ? { ...where, id } : { id };
    const request = await this.requestsRepository.findOne({ where: findWhere });

    if (!request) {
      throw new NotFoundException();
    }

    if (currentAccount.role !== AccountRole.ADMIN) {
      await this.hotelsService.findByIdForAccount(request.hotelId, currentAccount);
    }

    const staffNotes: any[] = Array.isArray(request.staffNotes)
      ? JSON.parse(JSON.stringify(request.staffNotes))
      : [];
    staffNotes.push({ 
      text: message, 
      addedAt: new Date().toISOString(),
      accountId: currentAccount.id
    });
    await request.update({ staffNotes });

    // Emit notification for new message (fail silently)
    const hotel = await this.hotelsService.findById(request.hotelId);
    const messagePreview = message.substring(0, 50);
    this.notificationsService.notify({
      eventType: 'NEW_MESSAGE',
      request,
      hotel,
      actor: currentAccount,
      messagePreview,
    });

    return {
      success: true,
      message: 'Staff message appended',
      data: request,
    };
  }
}
