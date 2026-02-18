import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Booking } from '../bookings/bookings.model';
import { Account } from '../accounts/accounts.model';

@Table({ tableName: 'chats' })
export class Chat extends Model<Chat> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id: number;

  @ForeignKey(() => Account)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'account_id',
  })
  accountId: number;

  @ForeignKey(() => Booking)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'booking_id',
  })
  bookingId: number;

  @BelongsTo(() => Account, { foreignKey: 'accountId', as: 'account' })
  account: Account;

  @BelongsTo(() => Booking, { foreignKey: 'bookingId', as: 'booking' })
  booking: Booking;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'language_code',
  })
  languageCode: string | null;
}
