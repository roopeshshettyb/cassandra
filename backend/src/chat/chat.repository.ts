import { Chat } from './chat.model';

export const CHAT_REPOSITORY = 'CHAT_REPOSITORY';

export const ChatRepository = {
  provide: CHAT_REPOSITORY,
  useValue: Chat,
};
