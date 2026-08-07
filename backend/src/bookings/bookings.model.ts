import { Table, Model, Column, DataType, ForeignKey, BelongsTo, HasMany } from 'sequelize-typescript';
import { Hotel } from '../hotels/hotels.model';
import { Account } from '../accounts/accounts.model';
import { Request } from '../requests/requests.model';

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
  })
  roomNumber: string;

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

  @BelongsTo(() => Hotel, { foreignKey: 'hotelId', as: 'hotel' })
  hotel: Hotel;

  @BelongsTo(() => Account, { foreignKey: 'guestId', targetKey: 'id', as: 'guest' })
  guest: Account;

  @HasMany(() => Request, { foreignKey: 'bookingId', as: 'requests' })
  requests: Request[];
}
