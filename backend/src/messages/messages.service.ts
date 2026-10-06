import { Inject, Injectable } from '@nestjs/common';
import { Op } from 'sequelize';
import { MESSAGES_REPOSITORY, NOTES_REPOSITORY } from './messages.repository';
import { Message, MessageRole, ToolCallRecord } from './message.model';
import { Note } from './note.model';

export interface NoteInput {
  chatId: number;
  accountId?: number | null;
  hotelId?: number | null;
  sourceMessageId?: number | null;
  subject?: string | null;
  content: string;
}

@Injectable()
export class MessagesService {
  /**
   * Whether this database actually has the raw_content column.
   *
   * Migrations here are best-effort — the application's role does not own every
   * table, so `ALTER TABLE` is logged and skipped rather than applied, and a
   * deploy can legitimately run ahead of a DBA. Writing a column that is not
   * there does not degrade, it fails the whole insert and the caller loses
   * their message. So it is asked once and honoured, and the moment the column
   * is added this starts populating on its own.
   */
  private rawContentColumn: Promise<boolean> | null = null;

  constructor(
    @Inject(MESSAGES_REPOSITORY) private readonly messageRepository: typeof Message,
    @Inject(NOTES_REPOSITORY) private readonly noteRepository: typeof Note,
  ) {}

  createNote(input: NoteInput): Promise<Note> {
    return this.noteRepository.create({
      chatId: input.chatId,
      accountId: input.accountId ?? null,
      hotelId: input.hotelId ?? null,
      sourceMessageId: input.sourceMessageId ?? null,
      subject: input.subject ?? null,
      content: input.content,
    } as any);
  }

  /**
   * One note per subject, newest winning, oldest first.
   *
   * What the agent reads back is what it last knew about each thing, not every
   * revision — a caller who moves their dates should leave one answer behind,
   * not two that contradict. id breaks the createdAt tie, because two notes are
   * written in the same second when someone gives two things at once.
   */
  async currentNotesByChatId(chatId: number, limit: number): Promise<Note[]> {
    const notes = await this.noteRepository.findAll({
      where: { chatId },
      order: [['createdAt', 'asc'], ['id', 'asc']],
      limit,
    });
    const bySubject = new Map<string, Note>();
    const unsubjected: Note[] = [];
    for (const note of notes) {
      if (note.subject) {
        bySubject.set(note.subject, note);
      } else {
        unsubjected.push(note);
      }
    }
    return [...bySubject.values(), ...unsubjected];
  }

  private hasRawContentColumn(): Promise<boolean> {
    if (!this.rawContentColumn) {
      this.rawContentColumn = this.messageRepository.sequelize!
        .getQueryInterface()
        .describeTable(this.messageRepository.getTableName() as string)
        .then((columns: any) => Object.prototype.hasOwnProperty.call(columns, 'raw_content'))
        .catch(() => false);
    }
    return this.rawContentColumn;
  }

  async findRecentByChatId(chatId: number, limit: number = 50): Promise<Message[]> {
    const rows = await this.messageRepository.findAll({
      where: { chatId },
      // id breaks the tie: a voice turn writes the question and the answer in the
      // same second, and createdAt alone leaves their order to the database.
      order: [['createdAt', 'desc'], ['id', 'desc']],
      limit,
    });
    return rows.reverse();
  }

  /**
   * Messages across several chats in one query, chronological. Lets a caller
   * summarise a page of chats without a query per chat.
   */
  async findByChatIds(chatIds: number[]): Promise<Message[]> {
    if (chatIds.length === 0) {
      return [];
    }
    return this.messageRepository.findAll({
      where: { chatId: { [Op.in]: chatIds } },
      order: [['id', 'asc']],
    });
  }

  /**
   * `rawContent` is only stored when it differs from what a reader sees — there
   * is no value in keeping a second identical copy of every message.
   */
  /**
   * `rawContent` keeps what the model actually wrote, cues and all, while
   * `content` holds what a person reads.
   *
   * It is written by a separate statement rather than declared on the model on
   * purpose: an attribute on the model is selected by every query, so a
   * database that has not had the column added yet would fail reads as well as
   * writes. This way its absence costs the reference copy and nothing else.
   */
  async create(chatId: number, role: MessageRole, content: string, toolCalls?: ToolCallRecord[], rawContent?: string): Promise<Message> {
    const message = await this.messageRepository.create({
      chatId,
      role,
      content,
      toolCalls: toolCalls ?? null,
    });
    if (rawContent !== undefined && rawContent !== content && (await this.hasRawContentColumn())) {
      await this.messageRepository.sequelize!.query(
        `UPDATE ${this.messageRepository.getTableName()} SET raw_content = :rawContent WHERE id = :id`,
        { replacements: { rawContent, id: message.id } },
      );
    }
    return message;
  }

  async countByChatId(chatId: number): Promise<number> {
    return this.messageRepository.count({ where: { chatId } });
  }

  // Messages in chat with id > afterId, ASC chronological. For summarizer to fetch
  // unsummarized history beyond the last summary's range_end.
  async findByChatIdAfterId(chatId: number, afterId: number): Promise<Message[]> {
    return this.messageRepository.findAll({
      where: { chatId, id: { [Op.gt]: afterId } },
      order: [['id', 'asc']],
    });
  }
}
