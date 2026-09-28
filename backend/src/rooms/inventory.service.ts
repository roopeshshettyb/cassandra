import { Inject, Injectable, BadRequestException, ConflictException } from '@nestjs/common';
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
    const sequelize = this.roomInventoryRepository.sequelize;
    if (!sequelize) {
      throw new BadRequestException('Database connection is unavailable');
    }
    return sequelize;
  }

  /** Local YYYY-MM-DD, matching how booking timestamps are built from hotel check-in times. */
  toDateString(value: Date): string {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * The nights a stay consumes: check-in date through the night before check-out.
   * A guest arriving Oct 1 and leaving Oct 4 occupies Oct 1, 2 and 3 — the
   * checkout date itself is sellable to someone else.
   */
  nightsBetween(checkIn: Date, checkOut: Date): string[] {
    const nights: string[] = [];
    const cursor = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
    const last = new Date(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate());
    while (cursor < last) {
      nights.push(this.toDateString(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return nights;
  }

  /**
   * A room `r` that can be handed to a guest for the whole of :checkIn to
   * :checkOut: in service, and not held by any booking over those dates. Shared by
   * every query that picks or counts rooms, so they cannot disagree on "free".
   */
  private readonly freeRoomCondition = `r.status = :activeStatus
         AND r.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM booking_rooms br
           WHERE br.room_id = r.id
             AND br.deleted_at IS NULL
             AND br.check_in < :checkOut
             AND br.check_out > :checkIn
         )`;

  /** Room types at this hotel that can seat `guests` and have `rooms` free on every night. */
  async findAvailability(
    hotelId: number,
    nights: string[],
    checkIn: string,
    checkOut: string,
    guests: number,
    rooms: number,
  ): Promise<RoomTypeAvailability[]> {
    if (nights.length === 0) {
      return [];
    }
    // A stay is only bookable at the *worst* night's stock, so MIN across the
    // range is the answer — two good nights and one sold-out night is a no.
    //
    // The nights are generated and LEFT JOINed, never joined from the table: a
    // night with no inventory row has simply never been sold, so it is worth the
    // room type's full total_rooms. Requiring a row instead would report a hotel
    // whose inventory has not been opened yet as sold out, which is the same
    // answer as genuinely full.
    //
    // The counts alone overstate it when a room is out of service: total still
    // includes it, but no booking can be given it. So the answer is capped at the
    // rooms of the type that are actually free for the stay — the same test the
    // booking itself applies when it assigns rooms.
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

  /**
   * Materialise the inventory rows a stay needs, from the room type's total_rooms.
   *
   * Nothing creates room_inventory up front: a hotel would otherwise need a job
   * extending every room type to some arbitrary horizon, and any stay past that
   * horizon would read as sold out rather than as unsold. Rows are opened on
   * demand instead, so a room type is sellable on every future date the moment it
   * exists, and `total` is captured from the room type as each night opens.
   *
   * Only nights with no row yet are written. ON CONFLICT DO NOTHING is what makes
   * that safe under concurrency — two bookings opening the same night race to
   * INSERT, the loser blocks until the winner commits and then skips. It also
   * means an existing row is never touched: reserved, blocked and an adjusted
   * total all survive, so this can run before every reservation.
   */
  async ensureNights(roomTypeId: number, nights: string[], transaction: Transaction): Promise<void> {
    if (nights.length === 0) {
      return;
    }
    // reserved and blocked are left to their column defaults rather than written
    // as zeroes here. A soft-deleted row still occupies the primary key, so DO
    // NOTHING skips it and the reserve() below then fails the booking — which is
    // right: inventory is only soft-deleted when its hotel is being deleted.
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

  /**
   * Record rooms already sold elsewhere, with no availability check.
   *
   * For reservations pushed in from a hotel's PMS. Those rooms are sold whether
   * our counters agree or not, so there is nothing to approve or reject —
   * refusing would only leave our inventory claiming a room the front desk has
   * already given away. Never refused, unlike reserve().
   *
   * Capped at what the night can hold, so an oversold night reads as full rather
   * than going negative: reserved + blocked never exceeds total, so the write also
   * passes a CHECK (reserved + blocked <= total) where a database has one — the dev
   * database does, though no migration here creates it. The booking still records
   * its room in booking_rooms, and that room is what stops it being sold again.
   */
  async reserveExternal(roomTypeId: number, nights: string[], count: number, transaction: Transaction): Promise<void> {
    if (nights.length === 0) {
      return;
    }
    await this.sequelize.query(
      `UPDATE room_inventory
       SET reserved = GREATEST(reserved, LEAST(reserved + :count, total - blocked)), updated_at = NOW()
       WHERE room_type_id = :roomTypeId
         AND date IN (:nights)
         AND deleted_at IS NULL`,
      { replacements: { roomTypeId, nights, count }, transaction, type: QueryTypes.UPDATE },
    );
  }

  /**
   * Hold `count` rooms on every night, or hold none at all.
   *
   * The guard lives in the WHERE clause, not in a read-then-write: two requests
   * racing for the last room both see it free, but only one UPDATE matches the
   * `>= :count` predicate — the other updates zero rows and is rejected here.
   * A partial match (some nights had stock, others did not) is also a failure,
   * so the caller's transaction must roll back what did apply.
   */
  async reserve(roomTypeId: number, nights: string[], count: number, transaction: Transaction): Promise<void> {
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

  /**
   * Rooms of this type with nothing booked over the range, so booking_rooms can
   * record which room each reservation holds.
   *
   * Two bookings can only want the same room if they share a room type and an
   * overlapping night, and reserve() has already updated those room_inventory
   * rows — so the second transaction is still waiting there and cannot reach this
   * query until the first has committed its booking_rooms.
   */
  async findAvailableRooms(
    hotelId: number,
    roomTypeId: number,
    checkIn: string,
    checkOut: string,
    count: number,
    transaction: Transaction,
  ): Promise<{ id: number; roomNumber: string }[]> {
    return this.sequelize.query<{ id: number; roomNumber: string }>(
      `SELECT r.id, r.room_number AS "roomNumber"
       FROM rooms r
       WHERE r.hotel_id = :hotelId
         AND r.room_type_id = :roomTypeId
         AND ${this.freeRoomCondition}
       ORDER BY r.room_number
       LIMIT :count`,
      {
        replacements: { hotelId, roomTypeId, count, checkIn, checkOut, activeStatus: RoomStatus.ACTIVE },
        transaction,
        type: QueryTypes.SELECT,
      },
    );
  }

  /** How many rooms of this type could be handed out for the whole stay, however many are wanted. */
  async countFreeRooms(roomTypeId: number, checkIn: string, checkOut: string, transaction?: Transaction): Promise<number> {
    const [row] = await this.sequelize.query<{ free: number }>(
      `SELECT COUNT(*)::int AS "free"
       FROM rooms r
       WHERE r.room_type_id = :roomTypeId
         AND ${this.freeRoomCondition}`,
      { replacements: { roomTypeId, checkIn, checkOut, activeStatus: RoomStatus.ACTIVE }, transaction, type: QueryTypes.SELECT },
    );
    return row?.free ?? 0;
  }

  /**
   * Hand back the nights a set of bookings holds.
   *
   * Derived from booking_rooms rather than from the caller, so a booking whose
   * rooms were swapped mid-stay still releases exactly what it holds. The caller
   * must delete (or soft-delete) the booking_rooms rows in the same transaction:
   * this query only sees live rows, so that is what makes a second release a
   * no-op instead of a double refund.
   *
   * GREATEST(..., 0) is a backstop only. Reserved going negative would mean a
   * release without a matching reserve, which should be impossible.
   */
  async releaseForBookings(bookingIds: number[], transaction: Transaction): Promise<void> {
    if (bookingIds.length === 0) {
      return;
    }
    await this.sequelize.query(
      `UPDATE room_inventory ri
       SET reserved = GREATEST(ri.reserved - held.rooms, 0)
       FROM (
         SELECT r.room_type_id AS room_type_id,
                night::date AS date,
                COUNT(*) AS rooms
         FROM booking_rooms br
         JOIN rooms r ON r.id = br.room_id
         -- ::timestamp, not ::date: with two date arguments Postgres resolves
         -- generate_series to the timestamptz overload, which would drag the
         -- session time zone into a calculation that is purely calendar dates.
         CROSS JOIN LATERAL generate_series(br.check_in::timestamp, (br.check_out::date - 1)::timestamp, interval '1 day') AS night
         WHERE br.booking_id IN (:bookingIds)
           AND br.deleted_at IS NULL
         GROUP BY r.room_type_id, night::date
       ) held
       WHERE ri.room_type_id = held.room_type_id
         AND ri.date = held.date
         AND ri.deleted_at IS NULL`,
      { replacements: { bookingIds }, transaction, type: QueryTypes.UPDATE },
    );
  }

  /**
   * Hand back the nights from `fromDate` on, and end the holds there.
   *
   * For a guest who leaves early: the nights already stayed stay counted, the rest
   * go back on sale, and each hold's check_out moves to `fromDate` so the room reads
   * as free from then. Same order rule as releaseForBookings: the counts are worked
   * out from the holds before the holds are shortened.
   */
  async releaseFrom(bookingIds: number[], fromDate: string, transaction: Transaction): Promise<void> {
    if (bookingIds.length === 0) {
      return;
    }
    await this.sequelize.query(
      `UPDATE room_inventory ri
       SET reserved = GREATEST(ri.reserved - held.rooms, 0)
       FROM (
         SELECT r.room_type_id AS room_type_id,
                night::date AS date,
                COUNT(*) AS rooms
         FROM booking_rooms br
         JOIN rooms r ON r.id = br.room_id
         CROSS JOIN LATERAL generate_series(GREATEST(br.check_in, :fromDate::date)::timestamp, (br.check_out::date - 1)::timestamp, interval '1 day') AS night
         WHERE br.booking_id IN (:bookingIds)
           AND br.deleted_at IS NULL
         GROUP BY r.room_type_id, night::date
       ) held
       WHERE ri.room_type_id = held.room_type_id
         AND ri.date = held.date
         AND ri.deleted_at IS NULL`,
      { replacements: { bookingIds, fromDate }, transaction, type: QueryTypes.UPDATE },
    );
    await this.sequelize.query(
      `UPDATE booking_rooms
       SET check_out = GREATEST(check_in, :fromDate::date), updated_at = NOW()
       WHERE booking_id IN (:bookingIds)
         AND deleted_at IS NULL
         AND check_out > :fromDate::date`,
      { replacements: { bookingIds, fromDate }, transaction, type: QueryTypes.UPDATE },
    );
  }

  /** How many nights nightsBetween would return, worked out without building the list. */
  nightCount(checkIn: Date, checkOut: Date): number {
    const first = Date.UTC(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
    const last = Date.UTC(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate());
    return Math.max(0, Math.round((last - first) / 86400000));
  }

  nightCountBetweenDates(startDate: string, endDate: string): number {
    return this.nightCount(this.parseDate(startDate), this.parseDate(endDate));
  }

  /** A night list from two YYYY-MM-DD strings, parsed as calendar dates rather than UTC instants. */
  nightsBetweenDates(startDate: string, endDate: string): string[] {
    return this.nightsBetween(this.parseDate(startDate), this.parseDate(endDate));
  }

  private parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  /** True for a YYYY-MM-DD that exists on the calendar; JS would roll 2026-02-30 over to March 2. */
  isCalendarDate(value: string): boolean {
    return this.toDateString(this.parseDate(value)) === value;
  }

  /** The inventory calendar for a range, with `available` derived rather than stored. */
  async findRange(roomTypeId: number, nights: string[], transaction?: Transaction): Promise<RoomInventoryRow[]> {
    if (nights.length === 0) {
      return [];
    }
    // LEFT JOIN from the requested nights, not from the table: a night with no row
    // yet is unsold, and reporting it as missing would read as sold out instead.
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
      { replacements: { roomTypeId, nights }, transaction, type: QueryTypes.SELECT },
    );
  }

  /**
   * Restock or hold back rooms across a range.
   *
   * Nights are opened first so a date nobody has booked can still be blocked.
   * The `>= 0` guard rejects the whole range if any night is already reserved
   * beyond what the new numbers would leave — dropping total below what is sold
   * is an oversell, not a correction.
   */
  async setForNights(roomTypeId: number, nights: string[], total: number | undefined, blocked: number | undefined, transaction: Transaction): Promise<void> {
    await this.ensureNights(roomTypeId, nights, transaction);
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
