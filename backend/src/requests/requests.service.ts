import { Inject, Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { REQUESTS_REPOSITORY } from './requests.repository';
import { Request, RequestStatus } from './requests.model';
import { CreateRequestDto, UpdateRequestDto } from './requests.dto';
import { Account, AccountRole } from '../accounts/accounts.model';
import { BookingsService } from '../bookings/bookings.service';
import { HotelsService } from '../hotels/hotels.service';
import { Op } from 'sequelize';

@Injectable()
export class RequestsService {
  constructor(@Inject(REQUESTS_REPOSITORY) private readonly requestsRepository: typeof Request, private readonly bookingsService: BookingsService, private readonly hotelsService: HotelsService) {}

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

    // Only hotel staff/owner (or admin) can mark a request as completed.
    if (dto.status === RequestStatus.COMPLETED) {
      const isStaffOrOwner =
        currentAccount.role === AccountRole.ADMIN ||
        currentAccount.role === AccountRole.HOTEL_OWNER ||
        currentAccount.role === AccountRole.HOTEL_STAFF;

      if (!isStaffOrOwner) {
        throw new ForbiddenException('Only hotel staff or owner can mark a request as completed');
      }
    }

    await request.update(dto);

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
    userNotes.push({ text: message, addedAt: new Date().toISOString() });
    await request.update({ userNotes });

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
    staffNotes.push({ text: message, addedAt: new Date().toISOString() });
    await request.update({ staffNotes });

    return {
      success: true,
      message: 'Staff message appended',
      data: request,
    };
  }
}
