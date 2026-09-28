import { Inject, Injectable, BadRequestException, ConflictException, ForbiddenException, NotFoundException, forwardRef } from '@nestjs/common';
import { Op, UniqueConstraintError } from 'sequelize';
import { ROOMS_REPOSITORY, ROOM_TYPES_REPOSITORY } from './rooms.repository';
import { RoomType } from './room-types.model';
import { Room, RoomStatus } from './rooms.model';
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
  RoomTypeImageUploadUrlDto,
  RoomTypeImageDto,
  NextRoomQueryDto,
} from './rooms.dto';
import { Account, AccountRole } from '../accounts/accounts.model';
import { HotelsService } from '../hotels/hotels.service';
import { ConstantsService, DEFAULT_AVAILABILITY_ROOMS, MAX_INVENTORY_NIGHTS, ROOM_TYPE_IMAGES_MAX_COUNT, ROOM_TYPE_IMAGE_MAX_FILE_SIZE_MB } from '../common/constants/constants.service';
import { AwsService } from '../common/aws/aws.service';

@Injectable()
export class RoomsService {
  constructor(
    @Inject(ROOM_TYPES_REPOSITORY) private readonly roomTypesRepository: typeof RoomType,
    @Inject(ROOMS_REPOSITORY) private readonly roomsRepository: typeof Room,
    @Inject(forwardRef(() => HotelsService)) private readonly hotelsService: HotelsService,
    private readonly inventoryService: InventoryService,
    private readonly awsService: AwsService,
    private readonly constantsService: ConstantsService,
  ) {}

  private get sequelize() {
    const sequelize = this.roomTypesRepository.sequelize;
    if (!sequelize) {
      throw new BadRequestException('Database connection is unavailable');
    }
    return sequelize;
  }

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
    // DATE_REGEX only checks the shape. A date like 2026-02-30 would roll over to
    // March in JS while the raw string still reaches Postgres, which rejects it.
    if (!this.inventoryService.isCalendarDate(startDate) || !this.inventoryService.isCalendarDate(endDate)) {
      throw new BadRequestException('Dates must be real calendar dates');
    }
    const count = this.inventoryService.nightCountBetweenDates(startDate, endDate);
    if (count === 0) {
      throw new BadRequestException('Check-out must be after check-in');
    }
    // Every night becomes an array entry, a query parameter and, on an update, a
    // room_inventory row, so an unbounded range would tie up the API and the DB.
    // Counted first so an oversized range is refused before any list is built.
    if (count > MAX_INVENTORY_NIGHTS) {
      throw new BadRequestException(`A range can cover at most ${MAX_INVENTORY_NIGHTS} nights`);
    }
    return this.inventoryService.nightsBetweenDates(startDate, endDate);
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
    // room_inventory hangs off the room type, so it has to go with it. Leaving the
    // rows behind would strand them against a type nothing can reach, and they
    // would silently come back into play if the primary key were ever reused.
    await this.sequelize.transaction(async (transaction) => {
      await RoomInventory.destroy({ where: { roomTypeId: id }, transaction });
      await roomType.destroy({ transaction });
    });

    return { success: true, message: 'Room type deleted', data: null };
  }

  /**
   * Presigned URL for a room type image, mirroring how hotel images are uploaded:
   * the browser PUTs straight to S3 and only the resulting URL comes back here.
   */
  async getImageUploadUrl(id: number, dto: RoomTypeImageUploadUrlDto, currentAccount: Account) {
    const roomType = await this.findRoomTypeForAccount(id, currentAccount);
    this.ensureCanManage(currentAccount);

    const keyPrefix = this.constantsService.private.AWS_S3_KEY_PREFIX;
    const s3Key = `${keyPrefix}room-type-images/${roomType.id}-${Date.now()}-${dto.fileName}`;
    const data = await this.awsService.createUploadUrl({
      key: s3Key,
      contentType: dto.contentType,
      fileSize: dto.fileSize,
      maxSizeMb: ROOM_TYPE_IMAGE_MAX_FILE_SIZE_MB,
      allowedType: 'image',
      isPublic: true,
    });

    return { success: true, message: null, data };
  }

  async addImage(id: number, dto: RoomTypeImageDto, currentAccount: Account) {
    const roomType = await this.findRoomTypeForAccount(id, currentAccount);
    this.ensureCanManage(currentAccount);

    const images = roomType.images || [];
    if (images.length >= ROOM_TYPE_IMAGES_MAX_COUNT) {
      throw new BadRequestException(`A room type can have at most ${ROOM_TYPE_IMAGES_MAX_COUNT} images`);
    }

    await roomType.update({ images: [...images, dto.s3Url] });

    return { success: true, message: 'Image added', data: roomType };
  }

  async removeImage(id: number, dto: RoomTypeImageDto, currentAccount: Account) {
    const roomType = await this.findRoomTypeForAccount(id, currentAccount);
    this.ensureCanManage(currentAccount);

    // Only the reference is dropped. The S3 object is left in place, matching how
    // hotel images behave — deleting it would break any copy of the URL already
    // handed out.
    await roomType.update({ images: (roomType.images || []).filter((url) => url !== dto.s3Url) });

    return { success: true, message: 'Image removed', data: roomType };
  }

  /**
   * Which room a booking would be given, without taking it.
   *
   * A preview for the booking form only. The real assignment still happens inside
   * the booking transaction, so this can go stale between showing and submitting —
   * which is fine, and is why nothing is reserved here.
   */
  async findNextRoom(query: NextRoomQueryDto, currentAccount: Account) {
    const roomType = await this.findRoomTypeForAccount(query.roomTypeId, currentAccount);
    this.ensureCanManage(currentAccount);
    if (roomType.hotelId !== query.hotelId) {
      throw new BadRequestException('That room type belongs to a different hotel');
    }

    const nights = this.nightsOrFail(query.startDate, query.endDate);
    const wanted = query.rooms ?? DEFAULT_AVAILABILITY_ROOMS;

    // Both reads share one transaction so the free rooms and the nightly counts
    // come from the same snapshot; read separately they could disagree.
    const { rooms, free, available } = await this.sequelize.transaction(async (transaction) => ({
      rooms: await this.inventoryService.findAvailableRooms(query.hotelId, query.roomTypeId, query.startDate, query.endDate, wanted, transaction),
      free: await this.inventoryService.countFreeRooms(query.roomTypeId, query.startDate, query.endDate, transaction),
      available: await this.inventoryService.findRange(query.roomTypeId, nights, transaction),
    }));

    // `nights` is never empty — nightsOrFail throws first — and findRange returns a
    // row per night, so there is always something to take the minimum of. Capped
    // at the free rooms for the same reason as the availability search: a room
    // out of service is in the counts but can never be handed out.
    const lowest = Math.max(0, Math.min(free, ...available.map((night) => night.available)));

    return {
      success: true,
      message: null,
      data: {
        // Only as many as can actually be sold. A physically free room on a night
        // whose sellable stock is gone is not one this booking would get, and
        // showing it beside "0 available" reads as a contradiction.
        roomNumbers: rooms.slice(0, lowest).map((room) => room.roomNumber),
        enough: lowest >= wanted,
        available: lowest,
      },
    };
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

    const roomNumber = this.cleanRoomNumber(dto.roomNumber);
    await this.ensureRoomNumberFree(dto.hotelId, roomNumber);

    const roomValues: any = { ...dto, roomNumber };
    const room = await this.withRoomNumberGuard(roomNumber, () => this.roomsRepository.create(roomValues));

    return { success: true, message: 'Room created', data: room };
  }

  /**
   * ensureRoomNumberFree is a read before the write, so two requests adding the same
   * number at once can both pass it. The unique index on (hotel_id, room_number)
   * stops the second; this turns its error into the same 409 the check gives.
   */
  private async withRoomNumberGuard<T>(roomNumber: string, write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new ConflictException(`Room ${roomNumber} already exists at this hotel`);
      }
      throw error;
    }
  }

  /**
   * Stored trimmed: a PMS sends '201' and its lookup trims, so '201 ' would never match
   * it, and would sit beside '201' as a second room the uniqueness check cannot see.
   */
  private cleanRoomNumber(value: string): string {
    const roomNumber = value.trim();
    if (!roomNumber) {
      throw new BadRequestException('Room number is required');
    }
    return roomNumber;
  }

  /** Held by a stay that has not checked out yet. Past holds are never cleared, so they do not count. */
  private async hasUpcomingHolds(roomId: number): Promise<boolean> {
    const today = this.inventoryService.toDateString(new Date());
    return (await BookingRoom.count({ where: { roomId, checkOut: { [Op.gt]: today } } })) > 0;
  }

  /**
   * One room per number at a hotel. The number is what a guest is told and what a
   * PMS sends back, so two rooms sharing one would put two guests behind the same
   * door and leave PMS bookings matched to whichever row the lookup finds first.
   */
  private async ensureRoomNumberFree(hotelId: number, roomNumber: string, exceptRoomId?: number): Promise<void> {
    const where: any = { hotelId, roomNumber };
    if (exceptRoomId !== undefined) {
      where.id = { [Op.ne]: exceptRoomId };
    }
    const existing = await this.roomsRepository.count({ where });
    if (existing > 0) {
      throw new ConflictException(`Room ${roomNumber} already exists at this hotel`);
    }
  }

  async updateRoom(id: number, dto: UpdateRoomDto, currentAccount: Account) {
    const room = await this.findRoomForAccount(id, currentAccount);
    this.ensureCanManage(currentAccount);

    // A booking holding this room names it by number and counts on it being in
    // service. Renumbering it would leave the booking pointing at a number that no
    // longer exists; taking it out of service would leave a guest assigned to it.
    const roomNumber = dto.roomNumber === undefined ? undefined : this.cleanRoomNumber(dto.roomNumber);
    const renumbering = roomNumber !== undefined && roomNumber !== room.roomNumber;
    const leavingService = dto.status !== undefined && dto.status !== RoomStatus.ACTIVE && room.status === RoomStatus.ACTIVE;
    if ((renumbering || leavingService) && (await this.hasUpcomingHolds(room.id))) {
      throw new BadRequestException('This room is held by a booking; cancel or move that booking first');
    }

    if (roomNumber !== undefined) {
      await this.ensureRoomNumberFree(room.hotelId, roomNumber, room.id);
    }

    const values: any = roomNumber === undefined ? dto : { ...dto, roomNumber };
    await this.withRoomNumberGuard(roomNumber ?? room.roomNumber, () => room.update(values));

    return { success: true, message: 'Room updated', data: room };
  }

  async deleteRoom(id: number, currentAccount: Account) {
    const room = await this.findRoomForAccount(id, currentAccount);
    this.ensureCanManage(currentAccount);

    // Mirrors the guard on deleting a room type. A room that is still held has a
    // guest arriving for it; removing it would leave the booking naming a room
    // that no longer exists while its nights stay reserved. Only stays that have
    // not checked out count — holds are never cleared once a stay ends, so
    // counting those would make every room that was ever booked undeletable.
    if (await this.hasUpcomingHolds(id)) {
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

    await this.sequelize.transaction(async (transaction) => {
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
      query.startDate,
      query.endDate,
      query.guests,
      query.rooms ?? DEFAULT_AVAILABILITY_ROOMS,
    );

    return { success: true, message: 'Availability fetched', data };
  }
}
