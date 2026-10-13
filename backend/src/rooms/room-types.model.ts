import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Hotel } from '../hotels/hotels.model';

@Table({ tableName: 'room_types' })
export class RoomType extends Model<RoomType> {
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

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  name: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'max_occupancy',
  })
  maxOccupancy: number;

  @Column({
    type: DataType.JSON,
    allowNull: true,
    defaultValue: [],
  })
  images: string[];

  @Column({
    type: DataType.JSON,
    allowNull: true,
    defaultValue: [],
  })
  perks: string[];

  // Copied into room_inventory.total when a night is first booked.
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'total_rooms',
  })
  totalRooms: number;

  @BelongsTo(() => Hotel, { foreignKey: 'hotelId', as: 'hotel' })
  hotel: Hotel;
}
