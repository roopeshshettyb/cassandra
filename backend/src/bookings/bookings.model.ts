import { Table, Model, Column, DataType, ForeignKey, BelongsTo, HasMany } from 'sequelize-typescript';
import { Hotel } from '../hotels/hotels.model';
import { Account } from '../accounts/accounts.model';
import { Request } from '../requests/requests.model';
import { Op } from 'sequelize';
import { BookingRoom } from './booking-rooms.model';
import { BookingStatus, DEFAULT_BOOKING_STATUS } from '../common/constants/constants.service';

@Table({ tableName: 'bookings' })
export class Booking extends Model<Booking> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id: number;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: 'start_time',
  })
  startTime: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: 'end_time',
  })
  endTime: Date;

  /**
   * Whether a stay is running now or still to come. Nothing stores it — it is the two times above
   * compared against now — so the column is VIRTUAL and declares the filter itself. 'active' takes a
   * stay starting exactly now, so 'upcoming' uses a strict `>` or one booking would answer to both.
   */
  @Column({
    type: DataType.VIRTUAL,
    filterable: true,
    filterOptions: [
      { value: 'active', label: 'Currently staying' },
      { value: 'upcoming', label: 'Upcoming stays' },
    ],
    filterWhere: (value: string) => {
      const now = new Date();
      if (value === 'active') return { startTime: { [Op.lte]: now }, endTime: { [Op.gte]: now } };
      return { startTime: { [Op.gt]: now } };
    },
  })
  stay: string;

  @ForeignKey(() => Account)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'guest_id',
  })
  guestId: number;

  @ForeignKey(() => Hotel)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'hotel_id',
  })
  hotelId: number;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'room_number',
    searchable: true,
  })
  roomNumber: string;

  // Reservation lifecycle from the Room & Inventory spec. Cancelling releases the
  // nights this booking holds in room_inventory (see BookingsService.updateForAccount).
  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: DEFAULT_BOOKING_STATUS,
  })
  status: BookingStatus;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'invite_email_sent_at',
  })
  inviteEmailSentAt: Date;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'reservation_document_s3_key',
  })
  reservationDocumentS3Key: string;

  // Source-of-truth id from the external PMS, for idempotent upserts via
  // /integrations/v1/bookings. Unique per hotel when set (see database.providers.ts).
  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'external_id',
  })
  externalId: string | null;

  @BelongsTo(() => Hotel, { foreignKey: 'hotelId', as: 'hotel' })
  hotel: Hotel;

  @BelongsTo(() => Account, { foreignKey: 'guestId', targetKey: 'id', as: 'guest' })
  guest: Account;

  @HasMany(() => Request, { foreignKey: 'bookingId', as: 'requests' })
  requests: Request[];

  @HasMany(() => BookingRoom, { foreignKey: 'bookingId', as: 'bookingRooms' })
  bookingRooms: BookingRoom[];
}
