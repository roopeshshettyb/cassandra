import { Table, Model, Column, DataType, HasMany } from 'sequelize-typescript';
import { Account } from '../accounts/accounts.model';

/**
 * A customer company: the hotel group an owner and their staff belong to.
 *
 * Admins sit outside every organisation — they are platform staff, so their
 * organisationId is null and null means "sees everything" rather than "orphaned".
 * Owners and staff always belong to one, and that membership is what scopes the
 * users they are allowed to see.
 *
 * Deliberately just name and description. Contact details and an active/disabled
 * flag were here and came out again: nothing asked for them, and every extra
 * column needed an ALTER on a table this application does not own, which turned
 * a one-statement deployment into a four-statement one for no gain. Adding them
 * later is cheap once ownership is sorted.
 */
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
