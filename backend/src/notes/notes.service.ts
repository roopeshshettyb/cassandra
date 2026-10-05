import { Inject, Injectable } from '@nestjs/common';
import { NOTES_REPOSITORY } from './notes.repository';
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
export class NotesService {
  constructor(@Inject(NOTES_REPOSITORY) private readonly noteRepository: typeof Note) {}

  async create(input: NoteInput): Promise<Note> {
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
   * The notes for one conversation, oldest first.
   *
   * id breaks the tie because several notes are written in the same second when
   * a caller gives two things at once, and createdAt alone leaves their order
   * to the database.
   */
  async findByChatId(chatId: number, limit: number): Promise<Note[]> {
    return this.noteRepository.findAll({
      where: { chatId },
      order: [['createdAt', 'asc'], ['id', 'asc']],
      limit,
    });
  }

  /**
   * One note per subject, newest winning.
   *
   * What the agent should read back is what it last knew about each thing, not
   * every revision of it — a caller who moves their dates should leave one
   * answer behind, not two that contradict.
   */
  async currentByChatId(chatId: number, limit: number): Promise<Note[]> {
    const notes = await this.findByChatId(chatId, limit);
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
}
