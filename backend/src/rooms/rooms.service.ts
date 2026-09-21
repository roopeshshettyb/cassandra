import { Inject, Injectable, BadRequestException, ForbiddenException, NotFoundException, forwardRef } from '@nestjs/common';
import { ROOMS_REPOSITORY, ROOM_TYPES_REPOSITORY } from './rooms.repository';
import { RoomType } from './room-types.model';
import { Room } from './rooms.model';
import { RoomInventory } from './room-inventory.model';
import { BookingRoom } from '../bookings/booking-rooms.model';
import { InventoryService } from './inventory.service';
import {
  AvailabilityQueryDto,
  CreateRoomDto,
  CreateRoomTypeDto,
  InventoryQueryDto,
  UpdateInventoryDto,
  UpdateRoomDto,
  UpdateRoomTypeDto,
} from './rooms.dto';
import { Account, AccountRole } from '../accounts/accounts.model';
import { HotelsService } from '../hotels/hotels.service';
import { DEFAULT_AVAILABILITY_ROOMS } from '../common/constants/constants.service';

@Injectable()
export class RoomsService {
  constructor(
    @Inject(ROOM_TYPES_REPOSITORY) private readonly roomTypesRepository: typeof RoomType,
    @Inject(ROOMS_REPOSITORY) private readonly roomsRepository: typeof Room,
    @Inject(forwardRef(() => HotelsService)) private readonly hotelsService: HotelsService,
    private readonly inventoryService: InventoryService,
  ) {}

  /** Membership of the hotel. Throws NotFound rather than Forbidden so a stranger learns nothing. */
  private async ensureCanAccessHotel(hotelId: number, currentAccount: Account): Promise<void> {
    await this.hotelsService.findByIdForAccount(hotelId, currentAccount);
  }

  private ensureCanManage(currentAccount: Account): void {
    if (currentAccount.role !== AccountRole.ADMIN && currentAccount.role !== AccountRole.HOTEL_OWNER && currentAccount.role !== AccountRole.HOTEL_STAFF) {
      throw new ForbiddenException();
    }
  }

  /**
   * Load a room type and prove the hotel it belongs to is one the caller can reach.
   *
   * Every inventory path routes through here. Trusting a roomTypeId from the body
   * would let a member of one hotel read or consume another hotel's inventory,
   * since room_inventory is keyed by room type alone and carries no hotel_id.
   */
  private async findRoomTypeForAccount(id: number, currentAccount: Account): Promise<RoomType> {
    const roomType = await this.roomTypesRepository.findByPk(id);
    if (!roomType) {
      throw new NotFoundException();
    }
    await this.ensureCanAccessHotel(roomType.hotelId, currentAccount);
    return roomType;
  }

  private async findRoomForAccount(id: number, currentAccount: Account): Promise<Room> {
    const room = await this.roomsRepository.findByPk(id);
    if (!room) {
      throw new NotFoundException();
    }
    await this.ensureCanAccessHotel(room.hotelId, currentAccount);
    return room;
  }

  private nightsOrFail(startDate: string, endDate: string): string[] {
    const nights = this.inventoryService.nightsBetweenDates(startDate, endDate);
    if (nights.length === 0) {
      throw new BadRequestException('Check-out must be after check-in');
    }
    return nights;
  }

  async findAllRoomTypes(hotelId: number, currentAccount: Account) {
    await this.ensureCanAccessHotel(hotelId, currentAccount);
    this.ensureCanManage(currentAccount);

    const roomTypes = await this.roomTypesRepository.findAll({ where: { hotelId }, order: [['name', 'ASC']] });

    return { success: true, message: 'Room types fetched', data: roomTypes };
  }

  async createRoomType(dto: CreateRoomTypeDto, currentAccount: Account) {
    await this.ensureCanAccessHotel(dto.hotelId, currentAccount);
    this.ensureCanManage(currentAccount);

    const roomTypeValues: any = dto;
    const roomType = await this.roomTypesRepository.create(roomTypeValues);

    return { success: true, message: 'Room type created', data: roomType };
  }

  async updateRoomType(id: number, dto: UpdateRoomTypeDto, currentAccount: Account) {
    const roomType = await this.findRoomTypeForAccount(id, currentAccount);
    this.ensureCanManage(currentAccount);

    await roomType.update(dto);

    return { success: true, message: 'Room type updated', data: roomType };
  }

  async deleteRoomType(id: number, currentAccount: Account) {
    const roomType = await this.findRoomTypeForAccount(id, currentAccount);
    this.ensureCanManage(currentAccount);

    const rooms = await this.roomsRepository.count({ where: { roomTypeId: id } });
    if (rooms > 0) {
      throw new BadRequestException('Remove the rooms of this type before deleting it');
    }

    const sequelize = this.roomTypesRepository.sequelize;
    if (!sequelize) {
      throw new BadRequestException('Database connection is unavailable');
    }

    // room_inventory hangs off the room type, so it has to go with it. Leaving the
    // rows behind would strand them against a type nothing can reach, and they
    // would silently come back into play if the primary key were ever reused.
    await sequelize.transaction(async (transaction) => {
      await RoomInventory.destroy({ where: { roomTypeId: id }, transaction });
      await roomType.destroy({ transaction });
    });

    return { success: true, message: 'Room type deleted', data: null };
  }

  async findAllRooms(hotelId: number, roomTypeId: number | undefined, currentAccount: Account) {
    await this.ensureCanAccessHotel(hotelId, currentAccount);
    this.ensureCanManage(currentAccount);

    const where: any = roomTypeId ? { hotelId, roomTypeId } : { hotelId };
    const rooms = await this.roomsRepository.findAll({
      where,
      include: [{ model: RoomType, as: 'roomType' }],
      order: [['roomNumber', 'ASC']],
    });

    return { success: true, message: 'Rooms fetched', data: rooms };
  }

  async createRoom(dto: CreateRoomDto, currentAccount: Account) {
    this.ensureCanManage(currentAccount);

    // The room type is checked as well as the hotel: hotelId and roomTypeId arrive
    // as two independent numbers, so a caller could otherwise pair their own hotel
    // with someone else's room type.
    const roomType = await this.findRoomTypeForAccount(dto.roomTypeId, currentAccount);
    if (roomType.hotelId !== dto.hotelId) {
      throw new BadRequestException('That room type belongs to a different hotel');
    }

    const roomValues: any = dto;
    const room = await this.roomsRepository.create(roomValues);

    return { success: true, message: 'Room created', data: room };
  }

  async updateRoom(id: number, dto: UpdateRoomDto, currentAccount: Account) {
    const room = await this.findRoomForAccount(id, currentAccount);
    this.ensureCanManage(currentAccount);

    await room.update(dto);

    return { success: true, message: 'Room updated', data: room };
  }

  async deleteRoom(id: number, currentAccount: Account) {
    const room = await this.findRoomForAccount(id, currentAccount);
    this.ensureCanManage(currentAccount);

    // Mirrors the guard on deleting a room type. A room that is still held has a
    // guest arriving for it; removing it would leave the booking naming a room
    // that no longer exists while its nights stay reserved.
    const holds = await BookingRoom.count({ where: { roomId: id } });
    if (holds > 0) {
      throw new BadRequestException('This room is held by a booking; cancel or move that booking first');
    }

    await room.destroy();

    return { success: true, message: 'Room deleted', data: null };
  }

  async findInventory(query: InventoryQueryDto, currentAccount: Account) {
    await this.findRoomTypeForAccount(query.roomTypeId, currentAccount);
    this.ensureCanManage(currentAccount);

    const nights = this.nightsOrFail(query.startDate, query.endDate);
    const data = await this.inventoryService.findRange(query.roomTypeId, nights);

    return { success: true, message: 'Inventory fetched', data };
  }

  async updateInventory(dto: UpdateInventoryDto, currentAccount: Account) {
    await this.findRoomTypeForAccount(dto.roomTypeId, currentAccount);
    this.ensureCanManage(currentAccount);

    if (dto.total === undefined && dto.blocked === undefined) {
      throw new BadRequestException('Provide total, blocked, or both');
    }

    const nights = this.nightsOrFail(dto.startDate, dto.endDate);
    const sequelize = this.roomTypesRepository.sequelize;
    if (!sequelize) {
      throw new BadRequestException('Database connection is unavailable');
    }

    await sequelize.transaction(async (transaction) => {
      await this.inventoryService.setForNights(dto.roomTypeId, nights, dto.total, dto.blocked, transaction);
    });

    const data = await this.inventoryService.findRange(dto.roomTypeId, nights);

    return { success: true, message: 'Inventory updated', data };
  }

  async findAvailability(query: AvailabilityQueryDto, currentAccount: Account) {
    await this.ensureCanAccessHotel(query.hotelId, currentAccount);

    const nights = this.nightsOrFail(query.startDate, query.endDate);
    const data = await this.inventoryService.findAvailability(
      query.hotelId,
      nights,
      query.guests,
      query.rooms ?? DEFAULT_AVAILABILITY_ROOMS,
    );

    return { success: true, message: 'Availability fetched', data };
  }
}
