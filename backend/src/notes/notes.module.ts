import { Module } from '@nestjs/common';
import { NotesService } from './notes.service';
import { NotesRepository } from './notes.repository';

@Module({
  providers: [NotesService, NotesRepository],
  exports: [NotesService],
})
export class NotesModule {}
