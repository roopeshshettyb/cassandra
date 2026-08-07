import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Hotel } from '../hotels/hotels.model';

export enum MenuItemCategory {
  APPETIZER = 'appetizer',
  MAIN_COURSE = 'main_course',
  DESSERT = 'dessert',
  BEVERAGE = 'beverage',
  SIDE = 'side',
  BREAKFAST = 'breakfast',
  LUNCH = 'lunch',
  DINNER = 'dinner',
  SNACKS = 'snacks',
}

@Table({ tableName: 'menu_items' })
export class MenuItem extends Model<MenuItem> {
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
    type: DataType.TEXT,
    allowNull: true,
  })
  description: string;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: true,
  })
  price: number;

  @Column({
    type: DataType.ENUM(...Object.values(MenuItemCategory)),
    allowNull: false,
  })
  category: MenuItemCategory;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'available_start_time',
  })
  availableStartTime: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'available_end_time',
  })
  availableEndTime: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_available',
  })
  isAvailable: boolean;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
    field: 'dietary_tags',
  })
  dietaryTags: string[];

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'image_url',
  })
  imageUrl: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'sort_order',
  })
  sortOrder: number;

  @BelongsTo(() => Hotel, { foreignKey: 'hotelId', as: 'hotel' })
  hotel: Hotel;
}
