import { Table, Model, Column, DataType, ForeignKey, BelongsTo, HasMany } from 'sequelize-typescript';
import { Account } from '../accounts/accounts.model';

@Table({ tableName: 'allrounder_chats' })
export class AllRounderChat extends Model<AllRounderChat> {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  id: number;

  @ForeignKey(() => Account)
  @Column({ type: DataType.INTEGER, allowNull: false, field: 'account_id' })
  accountId: number;

  @BelongsTo(() => Account, { foreignKey: 'accountId', as: 'account' })
  account: Account;
}
