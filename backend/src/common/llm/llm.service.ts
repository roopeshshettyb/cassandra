import { Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { ConstantsService } from '../constants/constants.service';

@Injectable()
export class LlmService {
  constructor(private readonly constantsService: ConstantsService) {}

  createModel(temperature = 0): ChatOpenAI {
    const llmConfig = this.constantsService.private.LLM;
    return new ChatOpenAI({
      modelName: llmConfig.TEXT_MODEL,
      apiKey: llmConfig.OPENROUTER.API_KEY,
      temperature,
      configuration: {
        baseURL: llmConfig.OPENROUTER.BASE_URL,
      },
    });
  }
}
