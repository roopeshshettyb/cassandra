import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Chat } from '../chat/chat.model';
import { Message } from '../messages/message.model';

export enum EvalDimension {
  TOOL_CALL = 'tool_call',
  RESPONSE_QUALITY = 'response_quality',
  SUMMARY_ACCURACY = 'summary_accuracy',
}

@Table({ tableName: 'llm_evals' })
export class LlmEval extends Model<LlmEval> {
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

  @ForeignKey(() => Message)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'message_id',
  })
  messageId: number;

  @Column({
    type: DataType.ENUM(...Object.values(EvalDimension)),
    allowNull: false,
  })
  dimension: EvalDimension;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
  })
  passed: boolean;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  reasoning: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'judge_model',
  })
  judgeModel: string;

  @BelongsTo(() => Chat, { foreignKey: 'chatId', as: 'chat' })
  chat: Chat;

  @BelongsTo(() => Message, { foreignKey: 'messageId', as: 'message' })
  message: Message;
}
