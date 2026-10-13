import { Inject, Injectable, ConflictException } from '@nestjs/common';
import { QueryTypes, Transaction } from 'sequelize';
import { ROOM_INVENTORY_REPOSITORY } from './rooms.repository';
import { RoomInventory } from './room-inventory.model';
import { RoomStatus } from './rooms.model';

export interface RoomInventoryRow {
  date: string;
  total: number;
  reserved: number;
  blocked: number;
  available: number;
}

export interface RoomTypeAvailability {
  roomTypeId: number;
  name: string;
  maxOccupancy: number;
  available: number;
}

@Injectable()
export class InventoryService {
  constructor(@Inject(ROOM_INVENTORY_REPOSITORY) private readonly roomInventoryRepository: typeof RoomInventory) {}

  private get sequelize() {
    return this.roomInventoryRepository.sequelize!;
  }

  toDateOnly(value: Date): string {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** Check-in date up to, but not including, the check-out date. */
  nightsBetween(checkIn: Date, checkOut: Date): string[] {
    const nights: string[] = [];
    const cursor = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
    const last = new Date(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate());
    while (cursor < last) {
      nights.push(this.toDateOnly(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return nights;
  }

  nightsBetweenDateStrings(startDate: string, endDate: string): string[] {
    return this.nightsBetween(this.parseDate(startDate), this.parseDate(endDate));
  }

  private parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  // Room `r` is in service and not assigned to any booking between :checkIn and :checkOut.
  private readonly freeRoomCondition = `r.status = :activeStatus
         AND r.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM booking_rooms br
           WHERE br.room_id = r.id
             AND br.deleted_at IS NULL
             AND br.check_in < :checkOut
             AND br.check_out > :checkIn
         )`;

  // Nights with no inventory row yet have never been sold, so they count as total_rooms.
  async findAvailableRoomTypes(
    hotelId: number,
    nights: string[],
    checkIn: string,
    checkOut: string,
    guests: number,
    rooms: number,
  ): Promise<RoomTypeAvailability[]> {
    return this.sequelize.query<RoomTypeAvailability>(
      `SELECT * FROM (
         SELECT rt.id AS "roomTypeId",
                rt.name AS "name",
                rt.max_occupancy AS "maxOccupancy",
                LEAST(
                  MIN(COALESCE(ri.total, rt.total_rooms) - COALESCE(ri.reserved, 0) - COALESCE(ri.blocked, 0)),
                  (SELECT COUNT(*) FROM rooms r WHERE r.room_type_id = rt.id AND ${this.freeRoomCondition})
                )::int AS "available"
         FROM room_types rt
         CROSS JOIN UNNEST(ARRAY[:nights]::date[]) AS night
         LEFT JOIN room_inventory ri ON ri.room_type_id = rt.id AND ri.date = night::date AND ri.deleted_at IS NULL
         WHERE rt.hotel_id = :hotelId AND rt.max_occupancy >= :guests AND rt.deleted_at IS NULL
         GROUP BY rt.id, rt.name, rt.max_occupancy
       ) availability
       WHERE availability."available" >= :rooms
       ORDER BY availability."name"`,
      {
        replacements: { hotelId, guests, rooms, nights, checkIn, checkOut, activeStatus: RoomStatus.ACTIVE },
        type: QueryTypes.SELECT,
      },
    );
  }

  async getInventoryForNights(roomTypeId: number, nights: string[]): Promise<RoomInventoryRow[]> {
    return this.sequelize.query<RoomInventoryRow>(
      `SELECT night::date::text AS "date",
              COALESCE(ri.total, rt.total_rooms)::int AS "total",
              COALESCE(ri.reserved, 0)::int AS "reserved",
              COALESCE(ri.blocked, 0)::int AS "blocked",
              (COALESCE(ri.total, rt.total_rooms) - COALESCE(ri.reserved, 0) - COALESCE(ri.blocked, 0))::int AS "available"
       FROM room_types rt
       CROSS JOIN UNNEST(ARRAY[:nights]::date[]) AS night
       LEFT JOIN room_inventory ri ON ri.room_type_id = rt.id AND ri.date = night::date AND ri.deleted_at IS NULL
       WHERE rt.id = :roomTypeId AND rt.deleted_at IS NULL
       ORDER BY night`,
      { replacements: { roomTypeId, nights }, type: QueryTypes.SELECT },
    );
  }

  /** Creates the missing inventory rows for these nights from the room type's total_rooms. */
  async createMissingInventoryRows(roomTypeId: number, nights: string[], transaction: Transaction): Promise<void> {
    await this.sequelize.query(
      `INSERT INTO room_inventory (room_type_id, date, total, created_at, updated_at)
       SELECT rt.id, night::date, rt.total_rooms, NOW(), NOW()
       FROM room_types rt
       CROSS JOIN UNNEST(ARRAY[:nights]::date[]) AS night
       WHERE rt.id = :roomTypeId AND rt.deleted_at IS NULL
       ON CONFLICT (room_type_id, date) DO NOTHING`,
      { replacements: { roomTypeId, nights }, transaction, type: QueryTypes.INSERT },
    );
  }

  /** Reserves `count` rooms on every night, or throws. The check is in the UPDATE so concurrent bookings cannot oversell. */
  async reserveInventoryOrFail(roomTypeId: number, nights: string[], count: number, transaction: Transaction): Promise<void> {
    const updated = await this.sequelize.query<{ date: string }>(
      `UPDATE room_inventory
       SET reserved = reserved + :count
       WHERE room_type_id = :roomTypeId
         AND date IN (:nights)
         AND deleted_at IS NULL
         AND total - reserved - blocked >= :count
       RETURNING date`,
      { replacements: { roomTypeId, nights, count }, transaction, type: QueryTypes.SELECT },
    );
    if (updated.length !== nights.length) {
      throw new ConflictException('Not enough rooms available for the selected dates');
    }
  }

  /** PMS bookings are already sold, so they are never refused; an oversold night is capped at full. */
  async reservePmsInventoryUpToCapacity(roomTypeId: number, nights: string[], count: number, transaction: Transaction): Promise<void> {
    await this.sequelize.query(
      `UPDATE room_inventory
       SET reserved = LEAST(reserved + :count, total - blocked), updated_at = NOW()
       WHERE room_type_id = :roomTypeId
         AND date IN (:nights)
         AND deleted_at IS NULL`,
      { replacements: { roomTypeId, nights, count }, transaction, type: QueryTypes.UPDATE },
    );
  }

  async findFreeRooms(
    roomTypeId: number,
    checkIn: string,
    checkOut: string,
    count: number,
    transaction?: Transaction,
  ): Promise<{ id: number; roomNumber: string }[]> {
    return this.sequelize.query<{ id: number; roomNumber: string }>(
      `SELECT r.id, r.room_number AS "roomNumber"
       FROM rooms r
       WHERE r.room_type_id = :roomTypeId
         AND ${this.freeRoomCondition}
       ORDER BY r.room_number
       LIMIT :count`,
      {
        replacements: { roomTypeId, count, checkIn, checkOut, activeStatus: RoomStatus.ACTIVE },
        transaction,
        type: QueryTypes.SELECT,
      },
    );
  }

  async countFreeRooms(roomTypeId: number, checkIn: string, checkOut: string): Promise<number> {
    const [row] = await this.sequelize.query<{ free: number }>(
      `SELECT COUNT(*)::int AS "free"
       FROM rooms r
       WHERE r.room_type_id = :roomTypeId
         AND ${this.freeRoomCondition}`,
      { replacements: { roomTypeId, checkIn, checkOut, activeStatus: RoomStatus.ACTIVE }, type: QueryTypes.SELECT },
    );
    return row.free;
  }

  /**
   * Gives back the nights these bookings reserved. Reads booking_rooms, so call it before deleting those rows.
   * Floored at 0 because reservePmsInventoryUpToCapacity caps PMS oversells, so releasing them could otherwise go negative.
   */
  async restoreInventoryForBookings(bookingIds: number[], transaction: Transaction): Promise<void> {
    await this.sequelize.query(
      `UPDATE room_inventory ri
       SET reserved = GREATEST(ri.reserved - booked.rooms, 0)
       FROM (
         SELECT r.room_type_id AS room_type_id,
                night::date AS date,
                COUNT(*) AS rooms
         FROM booking_rooms br
         JOIN rooms r ON r.id = br.room_id
         -- ::timestamp so generate_series does not use the timestamptz overload and the session time zone
         CROSS JOIN LATERAL generate_series(br.check_in::timestamp, (br.check_out::date - 1)::timestamp, interval '1 day') AS night
         WHERE br.booking_id IN (:bookingIds)
           AND br.deleted_at IS NULL
         GROUP BY r.room_type_id, night::date
       ) booked
       WHERE ri.room_type_id = booked.room_type_id
         AND ri.date = booked.date
         AND ri.deleted_at IS NULL`,
      { replacements: { bookingIds }, transaction, type: QueryTypes.UPDATE },
    );
  }

  /** Restocks or blocks rooms across a range; refuses if any night would end up oversold. */
  async updateTotalAndBlockedForNights(roomTypeId: number, nights: string[], total: number | undefined, blocked: number | undefined, transaction: Transaction): Promise<void> {
    await this.createMissingInventoryRows(roomTypeId, nights, transaction);
    const updated = await this.sequelize.query<{ date: string }>(
      `UPDATE room_inventory
       SET total = COALESCE(:total, total),
           blocked = COALESCE(:blocked, blocked),
           updated_at = NOW()
       WHERE room_type_id = :roomTypeId
         AND date IN (:nights)
         AND deleted_at IS NULL
         AND COALESCE(:total, total) - reserved - COALESCE(:blocked, blocked) >= 0
       RETURNING date`,
      { replacements: { roomTypeId, nights, total: total ?? null, blocked: blocked ?? null }, transaction, type: QueryTypes.SELECT },
    );
    if (updated.length !== nights.length) {
      throw new ConflictException('Those numbers would leave nights oversold; release the bookings on them first');
    }
  }
}
