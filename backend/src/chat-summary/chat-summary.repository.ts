import { ChatSummary } from './chat-summary.model';

export const CHAT_SUMMARY_REPOSITORY = 'CHAT_SUMMARY_REPOSITORY';

export const ChatSummaryRepository = {
  provide: CHAT_SUMMARY_REPOSITORY,
  useValue: ChatSummary,
};
