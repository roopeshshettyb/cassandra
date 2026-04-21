import { Inject, Injectable, ForbiddenException, NotFoundException, BadRequestException, forwardRef } from '@nestjs/common';
import { REQUESTS_REPOSITORY } from './requests.repository';
import { Request, RequestStatus } from './requests.model';
import { CreateRequestDto, UpdateRequestDto } from './requests.dto';
import { Account, AccountRole } from '../accounts/accounts.model';
import { BookingsService } from '../bookings/bookings.service';
import { HotelsService } from '../hotels/hotels.service';
import { Hotel } from '../hotels/hotels.model';
import { Booking } from '../bookings/bookings.model';
import { NotificationsService } from '../notifications/notifications.service';
import { Op } from 'sequelize';

@Injectable()
export class RequestsService {
  constructor(
    @Inject(REQUESTS_REPOSITORY) private readonly requestsRepository: typeof Request,
    @Inject(forwardRef(() => BookingsService)) private readonly bookingsService: BookingsService,
    private readonly hotelsService: HotelsService,
    private readonly notificationsService: NotificationsService,
  ) {}

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

  async findAllForAccount(currentAccount: Account) {
    const where = await this.getWhereForAccount(currentAccount);

    const findOptions: any = {
      order: [
        ['createdAt', 'DESC'],
        ['urgency', 'DESC'],
      ],
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

  async update(id: number, dto: UpdateRequestDto, currentAccount: Account) {
    const where = await this.getWhereForAccount(currentAccount);
    const findWhere = where ? { ...where, id } : { id };
    const request = await this.requestsRepository.findOne({ where: findWhere });

    if (!request) {
      throw new NotFoundException();
    }

    // Only hotel staff/owner (or admin) can change request status.
    if (dto.status !== undefined) {
      const isStaffOrOwner =
        currentAccount.role === AccountRole.ADMIN ||
        currentAccount.role === AccountRole.HOTEL_OWNER ||
        currentAccount.role === AccountRole.HOTEL_STAFF;

      if (!isStaffOrOwner) {
        throw new ForbiddenException('Only hotel staff or owner can change request status');
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
      message: 'Request updated',
      data: request,
    };
  }

  async findByBookingId(bookingId: number, currentAccount: Account, status?: RequestStatus) {
    const whereForAccount = await this.getWhereForAccount(currentAccount);
    const where: any = { bookingId };
    if (whereForAccount) {
      Object.assign(where, whereForAccount);
    }
    if (status) {
      where.status = status;
    }
    const requests = await this.requestsRepository.findAll({
      where,
      order: [
        ['createdAt', 'DESC'],
        ['urgency', 'DESC'],
      ],
    });
    return {
      success: true,
      message: null,
      data: requests,
    };
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
