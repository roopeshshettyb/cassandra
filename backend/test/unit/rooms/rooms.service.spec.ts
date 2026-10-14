import { NotFoundException } from '@nestjs/common';
import { RoomsService } from '../../../src/rooms/rooms.service';
import { mock, constants, guest, row, loose } from '../helpers';

// test/api/rooms.api.test.ts refuses outsiders on the other room routes; these are the ones it does not call.
describe('RoomsService', () => {
  const dates = { startDate: '2026-01-01', endDate: '2026-01-03' };
  let roomTypes: any, rooms: any;
  let service: RoomsService;

  beforeEach(() => {
    roomTypes = mock({ findByPk: jest.fn(async () => row({ id: 5, hotelId: 1, images: [] })) });
    rooms = mock({ findByPk: jest.fn(async () => row({ id: 7, hotelId: 1 })) });
    const hotelsService = mock({ findByIdForAccount: jest.fn(async () => Promise.reject(new NotFoundException())) });
    service = new RoomsService(roomTypes, rooms, hotelsService, mock(), mock(), constants);
  });

  it.each([
    ['deleteRoomType', (s: RoomsService) => s.deleteRoomType(5, guest())],
    ['getImageUploadUrl', (s: RoomsService) => s.getImageUploadUrl(5, loose({}), guest())],
    ['addImage', (s: RoomsService) => s.addImage(5, loose({}), guest())],
    ['removeImage', (s: RoomsService) => s.removeImage(5, loose({}), guest())],
    ['previewRoomAssignment', (s: RoomsService) => s.previewRoomAssignment(loose({ roomTypeId: 5, ...dates }), guest())],
    ['findAllRooms', (s: RoomsService) => s.findAllRooms(1, guest())],
    ['createRoom', (s: RoomsService) => s.createRoom(loose({ roomTypeId: 5, roomNumber: '1' }), guest())],
    ['updateInventory', (s: RoomsService) => s.updateInventory(loose({ roomTypeId: 5, ...dates }), guest())],
  ])('%s hides another hotel as NotFound', async (_name, call) => {
    await expect(call(service)).rejects.toThrow(NotFoundException);
    expect(roomTypes.destroy).not.toHaveBeenCalled();
    expect(rooms.create).not.toHaveBeenCalled();
  });
});
