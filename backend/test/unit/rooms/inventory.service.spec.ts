import { InventoryService } from '../../../src/rooms/inventory.service';
import { mock } from '../helpers';

// test/api/rooms.api.test.ts proves the night counting and the SQL against Postgres; these are the local-time edges.
describe('InventoryService dates', () => {
  const service = new InventoryService(mock());

  it('ignores the time of day', () => {
    expect(service.nightsBetween(new Date(2026, 0, 1, 23, 59), new Date(2026, 0, 2, 0, 1))).toEqual(['2026-01-01']);
  });

  it('formats a local date, not a UTC one', () => {
    expect(service.toDateOnly(new Date(2026, 8, 5, 22))).toBe('2026-09-05');
  });
});
