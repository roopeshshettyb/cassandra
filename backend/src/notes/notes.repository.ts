import { Note } from './note.model';

export const NOTES_REPOSITORY = 'NOTES_REPOSITORY';

export const NotesRepository = {
  provide: NOTES_REPOSITORY,
  useValue: Note,
};
