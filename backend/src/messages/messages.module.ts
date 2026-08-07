import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MessagesRepository } from './messages.repository';
import { MessagesService } from './messages.service';

@Module({
  imports: [DatabaseModule],
  providers: [MessagesRepository, MessagesService],
  exports: [MessagesRepository, MessagesService],
})
export class MessagesModule {}
