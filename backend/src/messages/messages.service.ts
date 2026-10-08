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
    });
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
      // The newest, so a long call drops its oldest notes rather than its latest.
      order: [['createdAt', 'desc'], ['id', 'desc']],
      limit,
    });
    notes.reverse();
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

  async create(chatId: number, role: MessageRole, content: string, toolCalls?: ToolCallRecord[]): Promise<Message> {
    return this.messageRepository.create({
      chatId,
      role,
      content,
      toolCalls: toolCalls ?? null,
    });
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
