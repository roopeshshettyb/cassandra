import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { AgentJobsService } from './agent-jobs.service';
import { CompleteAgentJobDto } from './agent-jobs.dto';
import { AgentWorkerGuard } from './agent-worker.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentAccount } from '../auth/decorators/account.decorator';
import { Account } from '../accounts/accounts.model';
import { ConstantsService } from '../common/constants/constants.service';

// Human-facing visibility into what the browser agent has been doing. Ownership is
// enforced in the service, so a hotel only ever sees its own jobs.
@Controller('hotels/:hotelId/agent-jobs')
@UseGuards(JwtAuthGuard)
export class AgentJobsController {
  constructor(
    private readonly agentJobsService: AgentJobsService,
    private readonly constantsService: ConstantsService,
  ) {}

  @Get()
  async list(@Param('hotelId', ParseIntPipe) hotelId: number, @CurrentAccount() account: Account) {
    const jobs = await this.agentJobsService.findAllForHotel(hotelId, account);
    return { success: true, message: this.constantsService.private.AGENT_JOBS.MSG_JOB_FETCHED, data: jobs };
  }
}

// Routes the Python browser worker pulls work from. Guarded by a shared worker
// secret only — never a session JWT or an integration token.
@Controller('agent-worker')
@UseGuards(AgentWorkerGuard)
export class AgentWorkerController {
  constructor(
    private readonly agentJobsService: AgentJobsService,
    private readonly constantsService: ConstantsService,
  ) {}

  // Long-poll target for the worker loop. Returns null data when idle so the worker
  // can back off rather than treating an empty queue as an error.
  @Post('claim')
  async claim() {
    const config = this.constantsService.private.AGENT_JOBS;
    const job = await this.agentJobsService.claimNext();
    if (!job) {
      return { success: true, message: config.MSG_NO_JOBS, data: null };
    }
    return { success: true, message: config.MSG_JOB_CLAIMED, data: job };
  }

  @Post(':id/complete')
  async complete(@Param('id', ParseIntPipe) id: number, @Body(ValidationPipe) dto: CompleteAgentJobDto) {
    const job = await this.agentJobsService.complete(id, dto);
    return { success: true, message: this.constantsService.private.AGENT_JOBS.MSG_JOB_COMPLETED, data: job };
  }
}
