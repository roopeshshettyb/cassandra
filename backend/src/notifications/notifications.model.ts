import { Table, Model, Column, DataType, ForeignKey } from 'sequelize-typescript';
import { Account } from '../accounts/accounts.model';

export enum NotificationType {
  DEAL_UPDATE = 'DEAL_UPDATE',
  PAYMENT = 'PAYMENT',
  SYSTEM = 'SYSTEM',
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
}
