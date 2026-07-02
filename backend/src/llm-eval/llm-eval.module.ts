import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { LangGraphModule } from '../langgraph/langgraph.module';
import { CostsModule } from '../costs/costs.module';
import { LlmEvalRepository } from './llm-eval.repository';
import { LlmEvalService } from './llm-eval.service';

@Module({
  imports: [DatabaseModule, CommonModule, forwardRef(() => LangGraphModule), CostsModule],
  providers: [LlmEvalRepository, LlmEvalService],
  exports: [LlmEvalService],
})
export class LlmEvalModule {}
