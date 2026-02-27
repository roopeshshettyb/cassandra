import { Injectable } from '@nestjs/common';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { LlmProvider } from './llm.provider';

export interface ILlmProvider {
  getModel(): BaseChatModel;
}

@Injectable()
export class LlmService {
  private provider: ILlmProvider;

  constructor(private readonly hfProvider: LlmProvider) {
    // Currently only HuggingFace LLM is supported.
    // To add a new provider, implement ILlmProvider and inject it here.
    this.provider = hfProvider;
  }

  getModel(): BaseChatModel {
    if (!this.provider) {
      throw new Error('LLM Provider not set');
    }
    return this.provider.getModel();
  }
}
