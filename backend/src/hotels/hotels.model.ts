import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { NotificationTone, DEFAULT_NOTIFICATION_TONE } from '../common/constants/constants.service';
import { HotelBrand } from './brands.model';

@Table({ tableName: 'hotels' })
export class Hotel extends Model<Hotel> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  name: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  address: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'check_in_time',
  })
  checkInTime: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'check_out_time',
  })
  checkOutTime: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'pool_hours',
  })
  poolHours: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'gym_hours',
  })
  gymHours: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'restaurant_hours',
  })
  restaurantHours: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'wifi_password',
  })
  wifiPassword: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'breakfast_hours',
  })
  breakfastHours: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'lunch_hours',
  })
  lunchHours: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'dinner_hours',
  })
  dinnerHours: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'snacks_hours',
  })
  snacksHours: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'house_keeping_hours',
  })
  houseKeepingHours: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'room_service_hours',
  })
  roomServiceHours: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'llm_instructions',
  })
  llmInstructions: string;

  @Column({
    type: DataType.JSON,
    allowNull: true,
    field: 'theme_config',
  })
  themeConfig: Record<string, unknown>;

  @Column({
    type: DataType.JSON,
    allowNull: true,
    field: 'avatar_config',
  })
  avatarConfig: {
    avatarUrl: string;
    idleAnimationPath: string;
    talkingAnimationPath: string;
    hiAnimationPath: string;
    thinkingAnimationPath: string;
  };

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'logo_url',
  })
  logoUrl: string;

  @Column({
    type: DataType.ENUM(...Object.values(NotificationTone)),
    allowNull: false,
    defaultValue: DEFAULT_NOTIFICATION_TONE,
    field: 'notification_tone',
  })
  notificationTone: NotificationTone;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'custom_tone_url',
  })
  customToneUrl: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  website: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'phone_number',
  })
  phoneNumber: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'google_maps_url',
  })
  googleMapsUrl: string;

  @ForeignKey(() => HotelBrand)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'hotel_brand_id',
  })
  hotelBrandId: number;

  @BelongsTo(() => HotelBrand)
  brand: HotelBrand;
}
