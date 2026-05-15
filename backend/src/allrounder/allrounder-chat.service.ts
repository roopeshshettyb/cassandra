import { Injectable, Inject } from '@nestjs/common';
import { AllRounderChat } from './allrounder-chat.model';
import { AllRounderMessage, AllRounderMessageRole, AllRounderToolCallRecord } from './allrounder-message.model';
import { ChatMessageInput } from '../langgraph/langgraph.service';

export const ALLROUNDER_CHAT_REPOSITORY = 'ALLROUNDER_CHAT_REPOSITORY';
export const ALLROUNDER_MESSAGE_REPOSITORY = 'ALLROUNDER_MESSAGE_REPOSITORY';

export const AllRounderChatRepository = { provide: ALLROUNDER_CHAT_REPOSITORY, useValue: AllRounderChat };
export const AllRounderMessageRepository = { provide: ALLROUNDER_MESSAGE_REPOSITORY, useValue: AllRounderMessage };

const CONTEXT_LIMIT = 20;

@Injectable()
export class AllRounderChatService {
  constructor(
    @Inject(ALLROUNDER_CHAT_REPOSITORY) private readonly chatRepo: typeof AllRounderChat,
    @Inject(ALLROUNDER_MESSAGE_REPOSITORY) private readonly messageRepo: typeof AllRounderMessage,
  ) {}

  async findOrCreateForAccount(accountId: number): Promise<AllRounderChat> {
    const existing = await this.chatRepo.findOne({ where: { accountId } });
    if (existing) return existing;
    return this.chatRepo.create({ accountId });
  }

  async saveMessage(chatId: number, role: AllRounderMessageRole, content: string, toolCalls?: AllRounderToolCallRecord[]): Promise<AllRounderMessage> {
    return this.messageRepo.create({ chatId, role, content, toolCalls: toolCalls ?? null });
  }

  async getRecentMessages(chatId: number, limit = 50): Promise<AllRounderMessage[]> {
    const rows = await this.messageRepo.findAll({
      where: { chatId },
      order: [['createdAt', 'DESC']],
      limit,
    });
    return rows.reverse();
  }

  buildContextString(messages: AllRounderMessage[]): string {
    if (!messages.length) return '(No messages yet)';
    let ctx = '';
    for (const msg of messages) {
      const label = msg.role === AllRounderMessageRole.USER ? 'User' : 'Assistant';
      ctx += `${label}: ${msg.content}\n\n`;
    }
    return ctx;
  }

  buildHistoryForPrompt(messages: AllRounderMessage[]): ChatMessageInput[] {
    const result: ChatMessageInput[] = [];
    for (const m of messages) {
      result.push({ role: m.role === AllRounderMessageRole.USER ? 'user' : 'assistant', content: m.content });
    }
    return result;
  }
}
