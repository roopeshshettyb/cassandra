import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Hotel } from './hotels.model';
import { Account } from '../accounts/accounts.model';
import { AccountRole } from '../accounts/accounts.model';
import { HotelMemberStatus } from '../common/constants/constants.service';

@Table({
  tableName: 'hotel_accounts',
})
export class HotelAccount extends Model<HotelAccount> {
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
  role: AccountRole;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  status: HotelMemberStatus;

  @BelongsTo(() => Account, { foreignKey: 'accountId', as: 'account' })
  account: Account;

  @BelongsTo(() => Hotel, { foreignKey: 'hotelId', as: 'hotel' })
  hotel: Hotel;
}
