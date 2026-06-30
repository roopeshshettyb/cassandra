import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Chat } from '../chat/chat.model';

@Table({ tableName: 'chat_summaries', paranoid: false })
export class ChatSummary extends Model<ChatSummary> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id: number;

  @ForeignKey(() => Chat)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'chat_id',
  })
  chatId: number;

  // Legacy column — always 1. Kept for schema compatibility.
  @Column({
    type: DataType.SMALLINT,
    allowNull: false,
    defaultValue: 1,
  })
  tier: number;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  summary: string;

  // Legacy column — kept for schema compatibility.
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'message_id_start',
  })
  messageIdStart: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'message_id_end',
  })
  messageIdEnd: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'token_estimate',
  })
  tokenEstimate: number;

  // Legacy column — always false. Kept for schema compatibility.
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  archived: boolean;

  @BelongsTo(() => Chat, { foreignKey: 'chatId', as: 'chat' })
  chat: Chat;
}
