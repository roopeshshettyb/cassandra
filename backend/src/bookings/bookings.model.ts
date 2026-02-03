import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Hotel } from '../hotels/hotels.model';
import { Account } from '../accounts/accounts.model';

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

  @BelongsTo(() => Hotel, { foreignKey: 'hotelId', as: 'hotel' })
  hotel: Hotel;

  @BelongsTo(() => Account, { foreignKey: 'guestId', targetKey: 'id', as: 'guest' })
  guest: Account;
}
