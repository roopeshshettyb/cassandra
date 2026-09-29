import { Inject, Injectable, BadRequestException, ConflictException, ForbiddenException, NotFoundException, forwardRef } from '@nestjs/common';
import { Op } from 'sequelize';
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
import { ConstantsService, DEFAULT_AVAILABILITY_ROOMS, ROOM_TYPE_IMAGES_MAX_COUNT, ROOM_TYPE_IMAGE_MAX_FILE_SIZE_MB } from '../common/constants/constants.service';
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
    return this.roomTypesRepository.sequelize!;
  }

  private async ensureCanAccessHotel(hotelId: number, currentAccount: Account): Promise<void> {
    await this.hotelsService.findByIdForAccount(hotelId, currentAccount);
  }

  private ensureCanManage(currentAccount: Account): void {
    if (currentAccount.role !== AccountRole.ADMIN && currentAccount.role !== AccountRole.HOTEL_OWNER && currentAccount.role !== AccountRole.HOTEL_STAFF) {
      throw new ForbiddenException();
    }
  }

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
    await this.sequelize.transaction(async (transaction) => {
      await RoomInventory.destroy({ where: { roomTypeId: id }, transaction });
      await roomType.destroy({ transaction });
    });

    return { success: true, message: 'Room type deleted', data: null };
  }

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

    if (roomType.images.length >= ROOM_TYPE_IMAGES_MAX_COUNT) {
      throw new BadRequestException(`A room type can have at most ${ROOM_TYPE_IMAGES_MAX_COUNT} images`);
    }

    await roomType.update({ images: [...roomType.images, dto.s3Url] });

    return { success: true, message: 'Image added', data: roomType };
  }

  async removeImage(id: number, dto: RoomTypeImageDto, currentAccount: Account) {
    const roomType = await this.findRoomTypeForAccount(id, currentAccount);
    this.ensureCanManage(currentAccount);

    await roomType.update({ images: roomType.images.filter((url) => url !== dto.s3Url) });

    return { success: true, message: 'Image removed', data: roomType };
  }

  /** Preview of the room(s) a booking would get. Nothing is reserved; the booking assigns rooms itself. */
  async findNextRoom(query: NextRoomQueryDto, currentAccount: Account) {
    await this.findRoomTypeForAccount(query.roomTypeId, currentAccount);
    this.ensureCanManage(currentAccount);

    const nights = this.nightsOrFail(query.startDate, query.endDate);
    const wanted = query.rooms ?? DEFAULT_AVAILABILITY_ROOMS;

    const rooms = await this.inventoryService.findAvailableRooms(query.roomTypeId, query.startDate, query.endDate, wanted);
    const free = await this.inventoryService.countFreeRooms(query.roomTypeId, query.startDate, query.endDate);
    const inventory = await this.inventoryService.findRange(query.roomTypeId, nights);
    // Rooms out of service are in the inventory counts but can never be assigned.
    const available = Math.min(free, ...inventory.map((night) => night.available));

    return {
      success: true,
      message: null,
      data: {
        roomNumbers: rooms.slice(0, available).map((room) => room.roomNumber),
        enough: available >= wanted,
        available,
      },
    };
  }

  async findAllRooms(hotelId: number, currentAccount: Account) {
    await this.ensureCanAccessHotel(hotelId, currentAccount);
    this.ensureCanManage(currentAccount);

    const rooms = await this.roomsRepository.findAll({
      where: { hotelId },
      include: [{ model: RoomType, as: 'roomType' }],
      order: [['roomNumber', 'ASC']],
    });

    return { success: true, message: 'Rooms fetched', data: rooms };
  }

  async createRoom(dto: CreateRoomDto, currentAccount: Account) {
    this.ensureCanManage(currentAccount);

    const roomType = await this.findRoomTypeForAccount(dto.roomTypeId, currentAccount);

    const roomNumber = dto.roomNumber.trim();
    await this.ensureRoomNumberFree(roomType.hotelId, roomNumber);

    const roomValues: any = { ...dto, hotelId: roomType.hotelId, roomNumber };
    const room = await this.roomsRepository.create(roomValues);

    return { success: true, message: 'Room created', data: room };
  }

  /** Held by a stay that has not checked out yet. */
  private async hasUpcomingHolds(roomId: number): Promise<boolean> {
    const today = this.inventoryService.toDateString(new Date());
    return (await BookingRoom.count({ where: { roomId, checkOut: { [Op.gt]: today } } })) > 0;
  }

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

    const roomNumber = dto.roomNumber?.trim();
    const renumbering = roomNumber !== undefined && roomNumber !== room.roomNumber;
    const leavingService = dto.status !== undefined && dto.status !== RoomStatus.ACTIVE && room.status === RoomStatus.ACTIVE;
    if ((renumbering || leavingService) && (await this.hasUpcomingHolds(room.id))) {
      throw new BadRequestException('This room is held by a booking; cancel or move that booking first');
    }

    if (roomNumber !== undefined) {
      await this.ensureRoomNumberFree(room.hotelId, roomNumber, room.id);
    }

    const values: any = roomNumber === undefined ? dto : { ...dto, roomNumber };
    await room.update(values);

    return { success: true, message: 'Room updated', data: room };
  }

  async deleteRoom(id: number, currentAccount: Account) {
    const room = await this.findRoomForAccount(id, currentAccount);
    this.ensureCanManage(currentAccount);

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
