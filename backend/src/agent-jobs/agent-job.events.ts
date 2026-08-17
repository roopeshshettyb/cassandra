import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

export const AGENT_JOB_CHAT_MESSAGE = 'agent_job_chat_message';

export interface AgentJobChatMessage {
  chatId: number;
  message: unknown;
}

/**
 * One-way bridge from the agent-jobs service to the chat gateway.
 *
 * The service cannot depend on ChatGateway directly: the gateway already reaches
 * AgentJobsService through LangGraph's tools, so injecting it back would close a
 * cycle. An emitter keeps the dependency one-directional — the service announces,
 * the gateway listens, and neither imports the other.
 */
@Injectable()
export class AgentJobEvents {
  private readonly emitter = new EventEmitter();

  emitChatMessage(chatId: number, message: unknown): void {
    this.emitter.emit(AGENT_JOB_CHAT_MESSAGE, { chatId, message } as AgentJobChatMessage);
  }

  onChatMessage(handler: (payload: AgentJobChatMessage) => void): void {
    this.emitter.on(AGENT_JOB_CHAT_MESSAGE, handler);
  }
}
