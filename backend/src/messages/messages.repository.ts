import { Note } from './note.model';
import { Message } from './message.model';

export const MESSAGES_REPOSITORY = 'MESSAGES_REPOSITORY';

export const MessagesRepository = {
  provide: MESSAGES_REPOSITORY,
  useValue: Message,
};

export const NOTES_REPOSITORY = 'NOTES_REPOSITORY';

export const NotesRepository = {
  provide: NOTES_REPOSITORY,
  useValue: Note,
};
