import { Table, Model, Column, DataType, HasMany } from 'sequelize-typescript';
import { Account } from '../accounts/accounts.model';

export enum OrganisationStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
}

/**
 * A customer company: the hotel group an owner and their staff belong to.
 *
 * Admins sit outside every organisation — they are platform staff, so their
 * organisationId is null and null means "sees everything" rather than "orphaned".
 * Owners and staff always belong to one, and that membership is what scopes the
 * users they are allowed to see.
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

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  contactEmail: string | null;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  contactPhone: string | null;

  @Column({
    type: DataType.ENUM(...Object.values(OrganisationStatus)),
    allowNull: false,
    defaultValue: OrganisationStatus.ACTIVE,
  })
  status: OrganisationStatus;

  @HasMany(() => Account)
  accounts: Account[];
}
