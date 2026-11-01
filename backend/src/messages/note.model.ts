import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Chat } from '../chat/chat.model';
import { Message } from '../messages/message.model';
import { Account } from '../accounts/accounts.model';

/**
 * Something the agent wrote down about whoever it is talking to.
 *
 * A note is kept apart from the message that caused it so it can be read back
 * without re-reading the conversation, and it keeps that message's id so anyone
 * looking at a note can see what was actually said to produce it — a note with
 * no provenance is just an assertion.
 *
 * accountId is null on the public reservation line, where the enquirer has no
 * account and the chat is the only handle on them.
 */
@Table({ tableName: 'notes' })
export class Note extends Model<Note> {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  id: number;

  @ForeignKey(() => Chat)
  @Column({ type: DataType.INTEGER, allowNull: false, field: 'chat_id' })
  chatId: number;

  @BelongsTo(() => Chat)
  chat: Chat;

  @ForeignKey(() => Account)
  @Column({ type: DataType.INTEGER, allowNull: true, field: 'account_id' })
  accountId: number | null;

  /** The hotel the note belongs to, so staff can only ever read their own. */
  @Column({ type: DataType.INTEGER, allowNull: true, field: 'hotel_id' })
  hotelId: number | null;

  /** What was said that made this worth writing down. */
  @ForeignKey(() => Message)
  @Column({ type: DataType.INTEGER, allowNull: true, field: 'source_message_id' })
  sourceMessageId: number | null;

  /**
   * A short label for what this note is about — "dates", "party size", "name".
   * Lets a later note on the same subject supersede an earlier one instead of
   * the agent reading two contradictory notes and picking.
   */
  @Column({ type: DataType.STRING, allowNull: true })
  subject: string | null;

  @Column({ type: DataType.TEXT, allowNull: false })
  content: string;
}
