import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Account } from '../accounts/accounts.model';

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

export enum MessageType {
  TEXT = 'text',
  VOICE = 'voice',
}

@Table({ tableName: 'messages' })
export class Message extends Model<Message> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'account_id',
  })
  accountId: number;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'session_id',
  })
  sessionId: string;

  @Column({
    type: DataType.ENUM(...Object.values(MessageRole)),
    allowNull: false,
  })
  role: MessageRole;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  content: string;

  @Column({
    type: DataType.ENUM(...Object.values(MessageType)),
    allowNull: false,
    defaultValue: MessageType.TEXT,
  })
  type: MessageType;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
    field: 'tool_calls',
  })
  toolCalls: any[];

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
    field: 'created_at',
  })
  createdAt: Date;
}
