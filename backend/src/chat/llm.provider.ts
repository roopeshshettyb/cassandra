import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ILlmProvider } from './llm.service';

/**
 * LLM provider.
 * Swap the underlying model by changing LLM_MODEL in your env file.
 * Swap the underlying service by editing this file only — no other file changes needed.
 */
@Injectable()
export class LlmProvider implements ILlmProvider {
  private readonly logger = new Logger(LlmProvider.name);

  getModel(): BaseChatModel {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for OpenAI LLM');
    }

    const model = process.env.LLM_MODEL || 'gpt-4o-mini';

    this.logger.log(`[LlmProvider] model: ${model}`);

    // Standard OpenAI implementation (supports proper tool calling & streaming)
    return new ChatOpenAI({
      modelName: model,
      apiKey: apiKey,
      temperature: 0.7,
      streaming: true, // OpenAI fully supports SSE streaming
    });
  }
}
