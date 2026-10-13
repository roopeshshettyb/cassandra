import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { RoomType } from './room-types.model';

// One row per room type per night. Available = total - reserved - blocked.
@Table({ tableName: 'room_inventory' })
export class RoomInventory extends Model<RoomInventory> {
  @ForeignKey(() => RoomType)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    primaryKey: true,
    field: 'room_type_id',
  })
  roomTypeId: number;

  @Column({
    type: DataType.DATEONLY,
    allowNull: false,
    primaryKey: true,
  })
  date: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
  })
  total: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
  })
  reserved: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
  })
  blocked: number;

  @BelongsTo(() => RoomType, { foreignKey: 'roomTypeId', as: 'roomType' })
  roomType: RoomType;
}
