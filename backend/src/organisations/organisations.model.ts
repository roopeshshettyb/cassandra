import { Table, Model, Column, DataType, HasMany } from 'sequelize-typescript';
import { Account } from '../accounts/accounts.model';

// The hotel group an owner and their staff belong to. Name and description only:
// extra columns would need an ALTER on a table this app does not own.
@Table({ tableName: 'organisations' })
export class Organisation extends Model<Organisation> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  name: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  description: string | null;

  @HasMany(() => Account)
  accounts: Account[];
}
