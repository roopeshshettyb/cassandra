import {
  Table,
  Model,
  Column,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Booking } from '../bookings/bookings.model';
import { Hotel } from '../hotels/hotels.model';
import { Account, AccountRole } from '../accounts/accounts.model';
import { Chat } from '../chat/chat.model';
import { Message } from '../messages/message.model';

export enum CostType {
  LLM_CHAT = 'llm_chat',
  LLM_VOICE = 'llm_voice',
}

@Table({ tableName: 'costs' })
export class Cost extends Model<Cost> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id: number;

  @Column({
    type: DataType.ENUM(...Object.values(CostType)),
    allowNull: false,
  })
  type: CostType;

  @Column({
    // Use DECIMAL to preserve arbitrary precision for money.
    type: DataType.DECIMAL(30, 18),
    allowNull: false,
  })
  amount: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'usd',
  })
  currency: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  meta: Record<string, unknown>;

  @ForeignKey(() => Booking)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'booking_id',
  })
  bookingId: number | null;

  @ForeignKey(() => Hotel)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'hotel_id',
  })
  hotelId: number | null;

  @ForeignKey(() => Account)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'account_id',
  })
  accountId: number | null;

  @Column({
    type: DataType.ENUM(...Object.values(AccountRole)),
    allowNull: true,
  })
  role: AccountRole | null;

  @ForeignKey(() => Chat)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'chat_id',
  })
  chatId: number | null;

  @ForeignKey(() => Message)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'message_id',
  })
  messageId: number | null;

  @BelongsTo(() => Booking, { foreignKey: 'bookingId', as: 'booking' })
  booking: Booking | null;

  @BelongsTo(() => Hotel, { foreignKey: 'hotelId', as: 'hotel' })
  hotel: Hotel | null;

  @BelongsTo(() => Account, { foreignKey: 'accountId', targetKey: 'id', as: 'account' })
  account: Account | null;

  @BelongsTo(() => Chat, { foreignKey: 'chatId', as: 'chat' })
  chat: Chat | null;

  @BelongsTo(() => Message, { foreignKey: 'messageId', as: 'message' })
  message: Message | null;
}

