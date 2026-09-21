import { RoomInventory } from './room-inventory.model';
import { RoomType } from './room-types.model';
import { Room } from './rooms.model';

export const ROOM_INVENTORY_REPOSITORY = 'ROOM_INVENTORY_REPOSITORY';
export const ROOM_TYPES_REPOSITORY = 'ROOM_TYPES_REPOSITORY';
export const ROOMS_REPOSITORY = 'ROOMS_REPOSITORY';

export const RoomInventoryRepository = {
  provide: ROOM_INVENTORY_REPOSITORY,
  useValue: RoomInventory,
};

export const RoomTypesRepository = {
  provide: ROOM_TYPES_REPOSITORY,
  useValue: RoomType,
};

export const RoomsRepository = {
  provide: ROOMS_REPOSITORY,
  useValue: Room,
};
