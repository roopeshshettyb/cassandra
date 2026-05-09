import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { AllRounderChat } from './allrounder-chat.model';

export enum AllRounderMessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

export interface AllRounderToolCallRecord {
  toolName: string;
  toolCallId: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
}

@Table({ tableName: 'allrounder_messages' })
export class AllRounderMessage extends Model<AllRounderMessage> {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  id: number;

  @ForeignKey(() => AllRounderChat)
  @Column({ type: DataType.INTEGER, allowNull: false, field: 'chat_id' })
  chatId: number;

  @Column({ type: DataType.ENUM(...Object.values(AllRounderMessageRole)), allowNull: false })
  role: AllRounderMessageRole;

  @Column({ type: DataType.TEXT, allowNull: false })
  content: string;

  @Column({ type: DataType.JSONB, allowNull: true, field: 'tool_calls' })
  toolCalls: AllRounderToolCallRecord[] | null;

  @BelongsTo(() => AllRounderChat, { foreignKey: 'chatId', as: 'chat' })
  chat: AllRounderChat;
}
