import { Table, Model, Column, DataType, ForeignKey } from 'sequelize-typescript';
import { Account } from '../accounts/accounts.model';
import { NotificationEventType } from '../common/constants/constants.service';

export enum NotificationType {
  DEAL_UPDATE = 'DEAL_UPDATE',
  PAYMENT = 'PAYMENT',
  SYSTEM = 'SYSTEM',
  NEW_REQUEST = 'NEW_REQUEST',
  REQUEST_UPDATED = 'REQUEST_UPDATED',
  NEW_BOOKING = 'NEW_BOOKING',
  NEW_MESSAGE = 'NEW_MESSAGE',
}

@Table({ tableName: 'notifications' })
export class Notification extends Model<Notification> {
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

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'hotel_id',
  })
  hotelId: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  title: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  message: string;

  @Column({
    type: DataType.ENUM(...Object.values(NotificationType)),
    allowNull: false,
    defaultValue: NotificationType.SYSTEM,
  })
  type: NotificationType;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  read: boolean;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  link: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'tone_url',
  })
  toneUrl: string;
}
