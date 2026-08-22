import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { AccountRole } from '../common/constants/constants.service';
import { Organisation } from '../organisations/organisations.model';

export enum AuthType {
  GOOGLE = 'google',
  X = 'x',
  EMAIL = 'email',
  INSTAGRAM = 'instagram',
}

export interface NotificationPreferences {
  push: boolean;
  email: boolean;
}

@Table({ tableName: 'accounts' })
export class Account extends Model<Account> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    unique: true,
  })
  id: number;

  @Column({
    type: DataType.STRING,
    primaryKey: true,
    unique: true,
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
    field: 'phone',
  })
  phone: string;

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

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: { push: true, email: true },
    field: 'notification_preferences',
  })
  notificationPreferences: NotificationPreferences;

  // Native FCM device tokens (from expo-notifications getDevicePushTokenAsync on iOS+Android).
  // Column kept as `expo_push_tokens` for backcompat with earlier Expo-relay implementation;
  // tokens are now sent directly via firebase-admin v1, not Expo's relay service.
  // Requires the column on the accounts table. On deploy run:
  //   ALTER TABLE accounts ADD COLUMN IF NOT EXISTS expo_push_tokens JSONB NOT NULL DEFAULT '[]'::jsonb;
  // (a dev DB without owner rights will 500 on account queries until added).
  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: [],
    field: 'expo_push_tokens',
  })
  expoPushTokens: string[];

  // Nullable on purpose, and null is meaningful rather than missing: admins are
  // platform staff who sit outside every organisation, and guests belong to a
  // hotel through their booking rather than to a company. Owners and staff have
  // one, and it is what scopes which users they may manage.
  //
  // Requires the column on the accounts table. sync() does not alter existing
  // tables, so on deploy run:
  //   ALTER TABLE accounts ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id);
  // (needs owner rights — the shared dev DB is owned by postgres, not the app
  // user, so account queries will 500 until someone privileged runs it).
  // See src/organisations/README.md for the full set.
  @ForeignKey(() => Organisation)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'organisation_id',
  })
  organisationId: number | null;

  @BelongsTo(() => Organisation)
  organisation: Organisation;
}

export { AccountRole };
