import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Booking } from '../bookings/bookings.model';
import { Account } from '../accounts/accounts.model';
import { Hotel } from '../hotels/hotels.model';

export enum ChatType {
  GENERAL = 'general',
  BOOKING = 'booking',
  RESERVATION = 'reservation',
}

@Table({ tableName: 'chats' })
export class Chat extends Model<Chat> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id: number;

  // Null for reservation chats: the enquirer is an anonymous member of the
  // public with no account yet. Every other chat type still has an owner.
  @ForeignKey(() => Account)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'account_id',
  })
  accountId: number | null;

  @ForeignKey(() => Booking)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'booking_id',
  })
  bookingId: number | null;

  // Set for reservation chats, which are scoped to the hotel being enquired
  // about rather than to a booking.
  @ForeignKey(() => Hotel)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'hotel_id',
  })
  hotelId: number | null;

  @BelongsTo(() => Hotel, { foreignKey: 'hotelId', as: 'hotel' })
  hotel: Hotel;

  @BelongsTo(() => Account, { foreignKey: 'accountId', as: 'account' })
  account: Account;

  @BelongsTo(() => Booking, { foreignKey: 'bookingId', as: 'booking' })
  booking: Booking;

  @Column({
    type: DataType.ENUM(ChatType.GENERAL, ChatType.BOOKING, ChatType.RESERVATION),
    allowNull: false,
    defaultValue: ChatType.GENERAL,
    field: 'chat_type',
  })
  chatType: ChatType;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'chat_name',
  })
  chatName: string | null;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'language_code',
  })
  languageCode: string | null;
}
