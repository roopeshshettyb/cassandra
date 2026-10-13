import { ConflictException } from '@nestjs/common';
import { InventoryService } from '../../../src/rooms/inventory.service';
import { mock, sequelize } from '../helpers';

// The SQL itself is proven against Postgres in test/api/rooms.api.test.ts; these cover the logic around it.
describe('InventoryService', () => {
  let db: any;
  let service: InventoryService;
  const tx: any = {};

  beforeEach(() => {
    db = sequelize();
    service = new InventoryService(mock({ sequelize: db }));
  });

  describe('dates', () => {
    it('counts the nights from check-in up to, not including, check-out', () => {
      expect(service.nightsBetweenDateStrings('2026-01-30', '2026-02-02')).toEqual(['2026-01-30', '2026-01-31', '2026-02-01']);
    });

    it('has no nights for a same-day or reversed stay', () => {
      expect(service.nightsBetweenDateStrings('2026-01-01', '2026-01-01')).toEqual([]);
      expect(service.nightsBetweenDateStrings('2026-01-02', '2026-01-01')).toEqual([]);
    });

    it('ignores the time of day', () => {
      expect(service.nightsBetween(new Date(2026, 0, 1, 23, 59), new Date(2026, 0, 2, 0, 1))).toEqual(['2026-01-01']);
    });

    it('formats a local date', () => {
      expect(service.toDateOnly(new Date(2026, 8, 5, 22))).toBe('2026-09-05');
    });
  });

  describe('reserveInventoryOrFail', () => {
    it('passes when every night was reserved', async () => {
      db.query.mockResolvedValue([{ date: 'a' }, { date: 'b' }]);
      await expect(service.reserveInventoryOrFail(1, ['a', 'b'], 1, tx)).resolves.toBeUndefined();
      expect(db.query.mock.calls[0][1]).toMatchObject({ replacements: { roomTypeId: 1, nights: ['a', 'b'], count: 1 }, transaction: tx });
    });

    it('refuses when any night had no room left', async () => {
      db.query.mockResolvedValue([{ date: 'a' }]);
      await expect(service.reserveInventoryOrFail(1, ['a', 'b'], 1, tx)).rejects.toThrow(new ConflictException('Not enough rooms available for the selected dates'));
    });
  });

  describe('updateTotalAndBlockedForNights', () => {
    it('creates the missing nights, then updates them', async () => {
      db.query.mockResolvedValueOnce(undefined).mockResolvedValueOnce([{ date: 'a' }]);
      await service.updateTotalAndBlockedForNights(1, ['a'], 5, undefined, tx);
      expect(db.query.mock.calls[0][0]).toContain('INSERT INTO room_inventory');
      expect(db.query.mock.calls[1][1].replacements).toMatchObject({ total: 5, blocked: null });
    });

    it('refuses a change that would oversell a night', async () => {
      db.query.mockResolvedValueOnce(undefined).mockResolvedValueOnce([]);
      await expect(service.updateTotalAndBlockedForNights(1, ['a'], 0, 0, tx)).rejects.toThrow(new ConflictException('Those numbers would leave nights oversold; release the bookings on them first'));
    });
  });

  it('countFreeRooms reads the count', async () => {
    db.query.mockResolvedValue([{ free: 3 }]);
    await expect(service.countFreeRooms(1, 'a', 'b')).resolves.toBe(3);
  });

  it.each([
    ['findAvailableRoomTypes', (s: InventoryService) => s.findAvailableRoomTypes(1, ['a'], 'a', 'b', 2, 1)],
    ['getInventoryForNights', (s: InventoryService) => s.getInventoryForNights(1, ['a'])],
    ['findFreeRooms', (s: InventoryService) => s.findFreeRooms(1, 'a', 'b', 2, tx)],
    ['reservePmsInventoryUpToCapacity', (s: InventoryService) => s.reservePmsInventoryUpToCapacity(1, ['a'], 1, tx)],
    ['restoreInventoryForBookings', (s: InventoryService) => s.restoreInventoryForBookings([1], tx)],
  ])('%s runs one query', async (_name, call) => {
    db.query.mockResolvedValue([]);
    await call(service);
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});
