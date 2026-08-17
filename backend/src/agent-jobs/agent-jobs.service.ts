import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Op } from 'sequelize';
import { AGENT_JOBS_REPOSITORY } from './agent-jobs.repository';
import { AgentJob, AgentJobAction, AgentJobStatus } from './agent-jobs.model';
import { CompleteAgentJobDto } from './agent-jobs.dto';
import { Account } from '../accounts/accounts.model';
import { HotelsService } from '../hotels/hotels.service';
import { MessagesService } from '../messages/messages.service';
import { MessageRole } from '../messages/message.model';
import { AgentJobEvents } from './agent-job.events';
import { ConstantsService } from '../common/constants/constants.service';
import { LoggerService } from '../common/logger.service';

@Injectable()
export class AgentJobsService {
  constructor(
    @Inject(AGENT_JOBS_REPOSITORY) private readonly agentJobsRepository: typeof AgentJob,
    private readonly hotelsService: HotelsService,
    private readonly constantsService: ConstantsService,
    private readonly messagesService: MessagesService,
    private readonly agentJobEvents: AgentJobEvents,
    private readonly loggerService: LoggerService,
  ) {}

  // Enqueue is deliberately cheap: the guest-facing agent calls this mid-conversation
  // and must get an answer in milliseconds, so nothing here touches a browser.
  async enqueue(
    hotelId: number,
    action: AgentJobAction,
    params: Record<string, unknown>,
    currentAccount: Account,
    chatId: number | null = null,
  ): Promise<AgentJob> {
    // Ownership: the caller must already have access to this hotel. Throws for
    // anyone else, so a job can never be queued against another property.
    await this.hotelsService.findByIdForAccount(hotelId, currentAccount);

    const config = this.constantsService.private.AGENT_JOBS;

    const queuedCount = await this.agentJobsRepository.count({
      where: { hotelId, status: AgentJobStatus.QUEUED },
    });
    if (queuedCount >= config.MAX_QUEUED_PER_HOTEL) {
      throw new BadRequestException(config.ERROR_QUEUE_FULL);
    }

    return this.agentJobsRepository.create({
      hotelId,
      requestedByAccountId: currentAccount.id,
      chatId,
      action,
      params,
      status: AgentJobStatus.QUEUED,
    });
  }

  async findByIdForAccount(id: number, currentAccount: Account): Promise<AgentJob> {
    const job = await this.agentJobsRepository.findOne({ where: { id } });
    if (!job) {
      throw new NotFoundException(this.constantsService.private.AGENT_JOBS.ERROR_JOB_NOT_FOUND);
    }
    // Re-check hotel access on read too — a job id must not leak another hotel's data.
    await this.hotelsService.findByIdForAccount(job.hotelId, currentAccount);
    return job;
  }

  async findAllForHotel(hotelId: number, currentAccount: Account): Promise<AgentJob[]> {
    await this.hotelsService.findByIdForAccount(hotelId, currentAccount);
    return this.agentJobsRepository.findAll({
      where: { hotelId },
      order: [['id', 'DESC']],
    });
  }

  // Claimed by the Python worker. Picks the oldest queued job and flips it to
  // running in one guarded update, so two workers polling at once cannot take the
  // same job — the UPDATE only matches rows still in 'queued'.
  async claimNext(): Promise<AgentJob | null> {
    await this.releaseStaleJobs();

    const candidate = await this.agentJobsRepository.findOne({
      where: { status: AgentJobStatus.QUEUED },
      order: [['id', 'ASC']],
    });
    if (!candidate) {
      return null;
    }

    const [affected] = await this.agentJobsRepository.update(
      {
        status: AgentJobStatus.RUNNING,
        claimedAt: new Date(),
        attemptCount: candidate.attemptCount + 1,
      },
      { where: { id: candidate.id, status: AgentJobStatus.QUEUED } },
    );

    // Lost the race to another worker — let the caller poll again rather than
    // handing back a job someone else owns.
    if (affected === 0) {
      return null;
    }

    return this.agentJobsRepository.findOne({ where: { id: candidate.id } });
  }

  // A worker that dies mid-task leaves its job stuck in 'running' forever. Anything
  // past the stale window goes back to the queue, or to failed once attempts run out.
  private async releaseStaleJobs(): Promise<void> {
    const config = this.constantsService.private.AGENT_JOBS;
    const cutoff = new Date(Date.now() - config.STALE_RUNNING_MINUTES * 60 * 1000);

    const stale = await this.agentJobsRepository.findAll({
      where: { status: AgentJobStatus.RUNNING, claimedAt: { [Op.lt]: cutoff } },
    });

    for (let i = 0; i < stale.length; i++) {
      const job = stale[i];
      const exhausted = job.attemptCount >= config.MAX_ATTEMPTS;
      job.status = exhausted ? AgentJobStatus.FAILED : AgentJobStatus.QUEUED;
      job.claimedAt = null;
      if (exhausted) {
        job.error = config.ERROR_JOB_NOT_RUNNING;
        job.finishedAt = new Date();
      }
      await job.save();
    }
  }

  async complete(id: number, dto: CompleteAgentJobDto): Promise<AgentJob> {
    const config = this.constantsService.private.AGENT_JOBS;
    const job = await this.agentJobsRepository.findOne({ where: { id } });
    if (!job) {
      throw new NotFoundException(config.ERROR_JOB_NOT_FOUND);
    }
    if (job.status !== AgentJobStatus.RUNNING) {
      throw new BadRequestException(config.ERROR_JOB_NOT_RUNNING);
    }

    job.status = dto.success ? AgentJobStatus.SUCCEEDED : AgentJobStatus.FAILED;
    job.result = dto.result ?? null;
    job.error = dto.error ?? null;
    // Only the worker's independent read-back sets this. Without it the result is
    // recorded but must not be reported to a guest as done.
    job.verifiedAt = dto.success && dto.verified ? new Date() : null;
    job.screenshotKeys = dto.screenshotKeys ?? [];
    job.durationMs = dto.durationMs ?? null;
    job.costUsd = dto.costUsd ?? null;
    job.finishedAt = new Date();
    await job.save();

    await this.deliverToChat(job);

    return job;
  }

  // A queued action is useless to a guest if nobody tells them the answer. The
  // conversation has already moved on by the time a browser task finishes, so the
  // result is posted back into the chat rather than waiting to be polled.
  //
  // What gets said depends on verification, not on success: an unconfirmed result
  // is never spoken as fact, because a second independent read did not agree with
  // the first.
  private async deliverToChat(job: AgentJob): Promise<void> {
    if (!job.chatId) {
      return;
    }
    const config = this.constantsService.private.AGENT_JOBS;

    let content: string;
    if (job.status === AgentJobStatus.FAILED) {
      content = config.CHAT_FAILED_MESSAGE;
    } else if (!job.verifiedAt) {
      content = config.CHAT_UNVERIFIED_MESSAGE;
    } else {
      const answer = typeof job.result?.answer === 'string' ? job.result.answer : JSON.stringify(job.result);
      content = `${config.CHAT_RESULT_PREFIX} ${answer}`;
    }

    // Delivery must never fail the job — the work already happened and the row is
    // the source of truth; a dropped message is recoverable, a lost result is not.
    try {
      const message = await this.messagesService.create(job.chatId, MessageRole.ASSISTANT, content);
      this.agentJobEvents.emitChatMessage(job.chatId, message);
    } catch (error) {
      this.loggerService.error({ error, serviceName: 'AgentJobsService', actionName: `deliverToChat job ${job.id}` });
    }
  }

  // Shaped for the conversational agent rather than the UI: it needs to know whether
  // it may speak the result, which is not the same as whether the job finished.
  buildAgentFacingStatus(job: AgentJob): Record<string, unknown> {
    const config = this.constantsService.private.AGENT_JOBS;

    if (job.status === AgentJobStatus.QUEUED || job.status === AgentJobStatus.RUNNING) {
      return { jobId: job.id, status: job.status, reportable: false, message: config.MSG_JOB_STILL_RUNNING };
    }
    if (job.status === AgentJobStatus.FAILED) {
      return { jobId: job.id, status: job.status, reportable: false, error: job.error };
    }
    if (!job.verifiedAt) {
      return { jobId: job.id, status: job.status, reportable: false, message: config.MSG_JOB_UNVERIFIED, result: job.result };
    }
    return { jobId: job.id, status: job.status, reportable: true, result: job.result };
  }
}
