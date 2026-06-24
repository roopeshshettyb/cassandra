import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Chat } from '../chat/chat.model';

// paranoid: false — summaries are derived/regeneratable; no soft-delete needed.
// Overrides the global `paranoid: true` set in database.config.ts (skips deleted_at column).
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

  // 1 = chunk summary (older messages), 2 = long-term meta summary
  @Column({
    type: DataType.SMALLINT,
    allowNull: false,
  })
  tier: number;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  summary: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
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

  // Tier-1 rows flip to true after promotion into tier-2
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  archived: boolean;

  @BelongsTo(() => Chat, { foreignKey: 'chatId', as: 'chat' })
  chat: Chat;
}
