import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { RoomsService } from '../../../src/rooms/rooms.service';
import { RoomStatus } from '../../../src/rooms/rooms.model';
import { RoomInventory } from '../../../src/rooms/room-inventory.model';
import { BookingRoom } from '../../../src/bookings/booking-rooms.model';
import { ROOM_TYPE_IMAGES_MAX_COUNT } from '../../../src/common/constants/constants.service';
import { mock, constants, staff, guest, row, sequelize, loose } from '../helpers';

describe('RoomsService', () => {
  let roomTypes: any, rooms: any, hotelsService: any, inventory: any, aws: any;
  let service: RoomsService;
  const dates = { startDate: '2026-01-01', endDate: '2026-01-03' };
  let roomType: any;

  beforeEach(() => {
    roomType = row({ id: 5, hotelId: 1, images: [] });
    roomTypes = mock({ sequelize: sequelize(), findByPk: jest.fn(async () => roomType), create: jest.fn(async (v: any) => ({ id: 5, ...v })) });
    rooms = mock({ count: jest.fn(async () => 0), create: jest.fn(async (v: any) => ({ id: 7, ...v })) });
    hotelsService = mock({ findByIdForAccount: jest.fn(async () => ({ id: 1 })) });
    inventory = mock({
      nightsBetweenDateStrings: jest.fn((a: string, b: string) => (b > a ? ['2026-01-01', '2026-01-02'] : [])),
      toDateOnly: jest.fn(() => '2026-01-01'),
      getInventoryForNights: jest.fn(async () => [{ available: 3 }, { available: 2 }]),
    });
    aws = mock({ createUploadUrl: jest.fn(async () => ({ url: 'https://put' })) });
    service = new RoomsService(roomTypes, rooms, hotelsService, inventory, aws, constants);
    jest.spyOn(BookingRoom, 'count').mockResolvedValue(loose(0));
  });

  afterEach(() => jest.restoreAllMocks());

  const noAccess = () => hotelsService.findByIdForAccount.mockRejectedValue(new NotFoundException());

  describe('room types', () => {
    it('lists a hotel room types', async () => {
      roomTypes.findAll.mockResolvedValue([roomType]);
      await expect(service.findAllRoomTypes(1, staff())).resolves.toMatchObject({ data: [roomType] });
    });

    it('creates one', async () => {
      await expect(service.createRoomType(loose({ hotelId: 1, name: 'Deluxe' }), staff())).resolves.toMatchObject({ data: { name: 'Deluxe' } });
    });

    it('updates one', async () => {
      await service.updateRoomType(5, loose({ name: 'Suite' }), staff());
      expect(roomType.update).toHaveBeenCalledWith({ name: 'Suite' });
    });

    it('deletes one with no rooms, with its inventory', async () => {
      jest.spyOn(RoomInventory, 'destroy').mockResolvedValue(loose(0));
      await expect(service.deleteRoomType(5, staff())).resolves.toMatchObject({ success: true });
      expect(RoomInventory.destroy).toHaveBeenCalledWith(expect.objectContaining({ where: { roomTypeId: 5 } }));
      expect(roomType.destroy).toHaveBeenCalled();
    });

    it('refuses to delete one that still has rooms', async () => {
      rooms.count.mockResolvedValue(2);
      await expect(service.deleteRoomType(5, staff())).rejects.toThrow(new BadRequestException('Remove the rooms of this type before deleting it'));
    });

    it('gives an image upload url', async () => {
      await service.getImageUploadUrl(5, loose({ fileName: 'a.png', fileSize: 1, contentType: 'image/png' }), staff());
      expect(aws.createUploadUrl).toHaveBeenCalledWith(expect.objectContaining({ key: expect.stringContaining('room-type-images/5-'), allowedType: 'image' }));
    });

    it('adds and removes an image', async () => {
      await service.addImage(5, loose({ s3Url: 'a' }), staff());
      expect(roomType.images).toEqual(['a']);
      await service.removeImage(5, loose({ s3Url: 'a' }), staff());
      expect(roomType.images).toEqual([]);
    });

    it('refuses an image past the limit', async () => {
      roomType.images = Array(ROOM_TYPE_IMAGES_MAX_COUNT).fill('x');
      await expect(service.addImage(5, loose({ s3Url: 'a' }), staff())).rejects.toThrow(new BadRequestException(`A room type can have at most ${ROOM_TYPE_IMAGES_MAX_COUNT} images`));
    });
  });

  describe('rooms', () => {
    let room: any;
    beforeEach(() => {
      room = row({ id: 7, hotelId: 1, roomNumber: '101', status: RoomStatus.ACTIVE });
      rooms.findByPk.mockResolvedValue(room);
    });

    it('lists a hotel rooms', async () => {
      rooms.findAll.mockResolvedValue([room]);
      await expect(service.findAllRooms(1, staff())).resolves.toMatchObject({ data: [room] });
    });

    it('creates a room at its type hotel, number trimmed', async () => {
      const res = await service.createRoom(loose({ roomTypeId: 5, roomNumber: ' 102 ', hotelId: 99 }), staff());
      expect(res.data).toMatchObject({ hotelId: 1, roomNumber: '102' });
    });

    it('refuses a number already used at the hotel', async () => {
      rooms.count.mockResolvedValue(1);
      await expect(service.createRoom(loose({ roomTypeId: 5, roomNumber: '101' }), staff())).rejects.toThrow(new ConflictException('Room 101 already exists at this hotel'));
    });

    it('renames a free room, checking the number excluding itself', async () => {
      await service.updateRoom(7, loose({ roomNumber: ' 105 ' }), staff());
      expect(rooms.count.mock.calls[0][0].where).toMatchObject({ hotelId: 1, roomNumber: '105' });
      expect(room.update).toHaveBeenCalledWith({ roomNumber: '105' });
    });

    it('refuses renaming onto a taken number', async () => {
      rooms.count.mockResolvedValue(1);
      await expect(service.updateRoom(7, loose({ roomNumber: '106' }), staff())).rejects.toThrow(ConflictException);
    });

    it.each([[{ roomNumber: '200' }], [{ status: RoomStatus.MAINTENANCE }]])('refuses %p while a booking holds the room', async (dto) => {
      jest.spyOn(BookingRoom, 'count').mockResolvedValue(loose(1));
      await expect(service.updateRoom(7, loose(dto), staff())).rejects.toThrow(new BadRequestException('This room is held by a booking; cancel or move that booking first'));
    });

    it('allows other changes while a booking holds the room', async () => {
      jest.spyOn(BookingRoom, 'count').mockResolvedValue(loose(1));
      await expect(service.updateRoom(7, loose({ roomNumber: '101' }), staff())).resolves.toMatchObject({ success: true });
    });

    it('deletes a free room', async () => {
      await service.deleteRoom(7, staff());
      expect(room.destroy).toHaveBeenCalled();
    });

    it('refuses deleting a held room', async () => {
      jest.spyOn(BookingRoom, 'count').mockResolvedValue(loose(1));
      await expect(service.deleteRoom(7, staff())).rejects.toThrow(new BadRequestException('This room is held by a booking; cancel or move that booking first'));
      expect(room.destroy).not.toHaveBeenCalled();
    });

    it.each(['updateRoom', 'deleteRoom'])('%s throws NotFound for a missing room', async (method) => {
      rooms.findByPk.mockResolvedValue(null);
      await expect(loose(service)[method](7, {}, staff())).rejects.toThrow(NotFoundException);
    });
  });

  describe('inventory and availability', () => {
    it('reads inventory for the nights', async () => {
      await expect(service.findInventory(loose({ roomTypeId: 5, ...dates }), staff())).resolves.toMatchObject({ data: [{ available: 3 }, { available: 2 }] });
    });

    it('updates inventory in a transaction', async () => {
      await service.updateInventory(loose({ roomTypeId: 5, ...dates, total: 4 }), staff());
      expect(inventory.updateTotalAndBlockedForNights).toHaveBeenCalledWith(5, ['2026-01-01', '2026-01-02'], 4, undefined, expect.anything());
    });

    it('finds availability for the party', async () => {
      inventory.findAvailableRoomTypes.mockResolvedValue([{ roomTypeId: 5 }]);
      await service.findAvailability(loose({ hotelId: 1, ...dates, guests: 2 }), staff());
      expect(inventory.findAvailableRoomTypes).toHaveBeenCalledWith(1, expect.any(Array), dates.startDate, dates.endDate, 2, 1);
    });

    it('previews rooms, capped by the scarcest night and free rooms', async () => {
      inventory.findFreeRooms.mockResolvedValue([{ roomNumber: '101' }, { roomNumber: '102' }, { roomNumber: '103' }]);
      inventory.countFreeRooms.mockResolvedValue(3);
      const res = await service.previewRoomAssignment(loose({ roomTypeId: 5, ...dates, rooms: 3 }), staff());
      expect(res.data).toEqual({ roomNumbers: ['101', '102'], enough: false, available: 2 });
    });

    it.each([
      ['findInventory', (s: any) => s.findInventory({ roomTypeId: 5, startDate: '2026-01-03', endDate: '2026-01-01' }, staff())],
      ['updateInventory', (s: any) => s.updateInventory({ roomTypeId: 5, startDate: '2026-01-01', endDate: '2026-01-01' }, staff())],
      ['findAvailability', (s: any) => s.findAvailability({ hotelId: 1, startDate: '2026-01-01', endDate: '2026-01-01' }, staff())],
      ['previewRoomAssignment', (s: any) => s.previewRoomAssignment({ roomTypeId: 5, startDate: '2026-01-01', endDate: '2026-01-01' }, staff())],
    ])('%s refuses a range with no nights', async (_name, call) => {
      await expect(call(service)).rejects.toThrow(new BadRequestException('Check-out must be after check-in'));
    });
  });

  describe('access', () => {
    it.each([
      ['findAllRoomTypes', (s: any) => s.findAllRoomTypes(1, guest())],
      ['createRoomType', (s: any) => s.createRoomType({ hotelId: 1 }, guest())],
      ['updateRoomType', (s: any) => s.updateRoomType(5, {}, guest())],
      ['deleteRoomType', (s: any) => s.deleteRoomType(5, guest())],
      ['getImageUploadUrl', (s: any) => s.getImageUploadUrl(5, {}, guest())],
      ['addImage', (s: any) => s.addImage(5, {}, guest())],
      ['removeImage', (s: any) => s.removeImage(5, {}, guest())],
      ['previewRoomAssignment', (s: any) => s.previewRoomAssignment({ roomTypeId: 5, ...dates }, guest())],
      ['findAllRooms', (s: any) => s.findAllRooms(1, guest())],
      ['createRoom', (s: any) => s.createRoom({ roomTypeId: 5, roomNumber: '1' }, guest())],
      ['updateRoom', (s: any) => s.updateRoom(7, {}, guest())],
      ['deleteRoom', (s: any) => s.deleteRoom(7, guest())],
      ['findInventory', (s: any) => s.findInventory({ roomTypeId: 5, ...dates }, guest())],
      ['updateInventory', (s: any) => s.updateInventory({ roomTypeId: 5, ...dates }, guest())],
      ['findAvailability', (s: any) => s.findAvailability({ hotelId: 1, ...dates }, guest())],
    ])('%s hides another hotel as NotFound', async (_name, call) => {
      rooms.findByPk.mockResolvedValue(row({ id: 7, hotelId: 1 }));
      noAccess();
      await expect(call(service)).rejects.toThrow(NotFoundException);
      expect(roomTypes.create).not.toHaveBeenCalled();
      expect(rooms.create).not.toHaveBeenCalled();
    });

    it.each([
      ['updateRoomType', (s: any) => s.updateRoomType(5, {}, staff())],
      ['createRoom', (s: any) => s.createRoom({ roomTypeId: 5, roomNumber: '1' }, staff())],
      ['findInventory', (s: any) => s.findInventory({ roomTypeId: 5, ...dates }, staff())],
    ])('%s throws NotFound for a missing room type', async (_name, call) => {
      roomTypes.findByPk.mockResolvedValue(null);
      await expect(call(service)).rejects.toThrow(NotFoundException);
    });
  });
});
