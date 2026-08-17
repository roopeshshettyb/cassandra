import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { AgentJobsRepository } from './agent-jobs.repository';
import { AgentJobsService } from './agent-jobs.service';
import { AgentJobsController, AgentWorkerController } from './agent-jobs.controller';
import { AgentWorkerGuard } from './agent-worker.guard';
import { AgentJobEvents } from './agent-job.events';
import { MessagesModule } from '../messages/messages.module';
import { HotelsModule } from '../hotels/hotels.module';

@Module({
  imports: [DatabaseModule, CommonModule, forwardRef(() => HotelsModule), forwardRef(() => MessagesModule)],
  controllers: [AgentJobsController, AgentWorkerController],
  providers: [AgentJobsRepository, AgentJobsService, AgentWorkerGuard, AgentJobEvents],
  exports: [AgentJobsService, AgentJobEvents],
})
export class AgentJobsModule {}
