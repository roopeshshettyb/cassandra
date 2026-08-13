import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { AgentJobsRepository } from './agent-jobs.repository';
import { AgentJobsService } from './agent-jobs.service';
import { AgentJobsController, AgentWorkerController } from './agent-jobs.controller';
import { AgentWorkerGuard } from './agent-worker.guard';
import { HotelsModule } from '../hotels/hotels.module';

@Module({
  imports: [DatabaseModule, CommonModule, forwardRef(() => HotelsModule)],
  controllers: [AgentJobsController, AgentWorkerController],
  providers: [AgentJobsRepository, AgentJobsService, AgentWorkerGuard],
  exports: [AgentJobsService],
})
export class AgentJobsModule {}
