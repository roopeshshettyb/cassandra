import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Hotel } from '../hotels/hotels.model';
import { RoomType } from './room-types.model';
import { RoomStatus } from '../common/constants/constants.service';

export { RoomStatus };

@Table({ tableName: 'rooms' })
export class Room extends Model<Room> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id: number;

  @ForeignKey(() => Hotel)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'hotel_id',
  })
  hotelId: number;

  @ForeignKey(() => RoomType)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'room_type_id',
  })
  roomTypeId: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'room_number',
  })
  roomNumber: string;

  @Column({
    type: DataType.ENUM(...Object.values(RoomStatus)),
    allowNull: false,
    defaultValue: RoomStatus.ACTIVE,
  })
  status: RoomStatus;

  @BelongsTo(() => Hotel, { foreignKey: 'hotelId', as: 'hotel' })
  hotel: Hotel;

  @BelongsTo(() => RoomType, { foreignKey: 'roomTypeId', as: 'roomType' })
  roomType: RoomType;
}
