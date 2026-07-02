import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Chat } from '../chat/chat.model';
import { Message } from '../messages/message.model';

export enum EvalDimension {
  TOOL_CALL = 'tool_call',
  RESPONSE_QUALITY = 'response_quality',
  SUMMARY_ACCURACY = 'summary_accuracy',
  ONBOARDING_EXTRACTION = 'onboarding_extraction',
  DOCUMENT_EXTRACTION = 'document_extraction',
  MENU_OCR = 'menu_ocr',
  CHAT_TITLE = 'chat_title',
}

@Table({ tableName: 'llm_evals' })
export class LlmEval extends Model<LlmEval> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id: number;

  // Nullable: chat-turn evals reference a chat/message, but extraction-flow
  // evals (onboarding, document, menu OCR) have no chat context.
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
