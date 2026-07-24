import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Hotel } from '../hotels/hotels.model';
import { Account } from '../accounts/accounts.model';

export enum IntegrationStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
}

// One row per hotel, created lazily on first token generation — a hotel with no
// row yet simply has no integration configured (no third "inactive" status needed).
@Table({ tableName: 'hotel_integrations' })
export class HotelIntegration extends Model<HotelIntegration> {
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
    unique: true,
    field: 'hotel_id',
  })
  hotelId: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'token_hash',
  })
  tokenHash: string;

  // Short prefix of the plaintext token, kept for display/identification in the
  // UI — the full token is never stored or shown again after generation.
  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'token_prefix',
  })
  tokenPrefix: string;

  @Column({
    type: DataType.ENUM(...Object.values(IntegrationStatus)),
    allowNull: false,
    defaultValue: IntegrationStatus.ACTIVE,
  })
  status: IntegrationStatus;

  @ForeignKey(() => Account)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'created_by_account_id',
  })
  createdByAccountId: number | null;

  @BelongsTo(() => Hotel, { foreignKey: 'hotelId', as: 'hotel' })
  hotel: Hotel;

  @BelongsTo(() => Account, { foreignKey: 'createdByAccountId', as: 'createdBy' })
  createdBy: Account | null;
}
