import { Message } from './message.model';

export const MESSAGES_REPOSITORY = 'MESSAGES_REPOSITORY';

export const MessagesRepository = {
  provide: MESSAGES_REPOSITORY,
  useValue: Message,
};
