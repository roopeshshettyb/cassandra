import { Table, Model, Column, DataType, ForeignKey, BelongsTo, HasMany } from 'sequelize-typescript';
import { Hotel } from '../hotels/hotels.model';
import { Room } from './rooms.model';

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

  // Same shape as hotels.images: a JSON array of public S3 URLs, ordered as the
  // guest should see them.
  @Column({
    type: DataType.JSON,
    allowNull: true,
    defaultValue: [],
  })
  images: string[];

  // Free-text inclusions — "Breakfast included", "Airport pickup". An array rather
  // than a fixed set, because what a room type throws in differs per hotel and the
  // list grows without a migration.
  @Column({
    type: DataType.JSON,
    allowNull: true,
    defaultValue: [],
  })
  perks: string[];

  // Sellable room count for this type. Inventory rows are created from this
  // value, and changing it only rewrites `total` for today onward.
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'total_rooms',
  })
  totalRooms: number;

  @BelongsTo(() => Hotel, { foreignKey: 'hotelId', as: 'hotel' })
  hotel: Hotel;

  @HasMany(() => Room, { foreignKey: 'roomTypeId', as: 'rooms' })
  rooms: Room[];
}
