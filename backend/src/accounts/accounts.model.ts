import { Table, Model, Column, DataType } from 'sequelize-typescript';
import { AccountRole } from '../common/constants/account-roles.constants';

export enum AuthType {
  GOOGLE = 'google',
  X = 'x',
  EMAIL = 'email',
  INSTAGRAM = 'instagram',
}

@Table({ tableName: 'accounts' })
export class Account extends Model<Account> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: false,
    unique: true,
  })
  id: number;

  @Column({
    type: DataType.STRING,
    primaryKey: true,
    field: 'uuid',
  })
  uuid: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
    field: 'oauth_meta',
  })
  oauthMeta: {
    [provider: string]: {
      accessToken?: string;
      refreshToken?: string;
      expiresIn?: number;
      expiresAt?: Date;
      [key: string]: any;
    };
  };

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'email',
  })
  email: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'name',
  })
  name: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'profile_pic_url',
  })
  profilePicUrl: string;

  @Column({
    type: DataType.ENUM(...Object.values(AccountRole)),
    allowNull: false,
    defaultValue: AccountRole.GUEST,
  })
  role: AccountRole;
  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'otp',
  })
  otp: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'otp_expires_at',
  })
  otpExpiresAt: Date;
}

export { AccountRole };
