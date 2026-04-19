import { Table, Model, Column, DataType, ForeignKey } from 'sequelize-typescript';
import { Account } from '../accounts/accounts.model';
import { Hotel } from '../hotels/hotels.model';

@Table({
  tableName: 'notification_preferences',
  indexes: [{ unique: true, fields: ['account_id', 'hotel_id'] }],
})
export class NotificationPreference extends Model<NotificationPreference> {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  id: number;

  @ForeignKey(() => Account)
  @Column({ type: DataType.INTEGER, allowNull: false, field: 'account_id' })
  accountId: number;

  @ForeignKey(() => Hotel)
  @Column({ type: DataType.INTEGER, allowNull: false, field: 'hotel_id' })
  hotelId: number;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true, field: 'push_enabled' })
  pushEnabled: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true, field: 'email_enabled' })
  emailEnabled: boolean;
}
