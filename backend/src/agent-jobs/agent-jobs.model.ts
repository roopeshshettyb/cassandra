import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Hotel } from '../hotels/hotels.model';
import { Account } from '../accounts/accounts.model';

export enum AgentJobStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
}

// Actions the browser worker knows how to perform. Deliberately a closed list:
// a spike showed an open-ended instruction took 118s and 8 steps where the same
// task scoped to one URL took 15s and 2 steps, so every action is narrow and
// carries its own navigation. Read-only for now — writes need the independent
// read-back verification described in verifiedAt below.
export enum AgentJobAction {
  PMS_LOOKUP_RESERVATION = 'pms_lookup_reservation',
  PMS_LIST_ARRIVALS = 'pms_list_arrivals',
}

// One row per requested browser action. The voice/chat agent enqueues and returns
// immediately — browser tasks measured 20–120s, far past conversational latency,
// so they can never run inside a turn.
@Table({ tableName: 'agent_jobs' })
export class AgentJob extends Model<AgentJob> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id: number;

  @ForeignKey(() => Hotel)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'hotel_id',
  })
  hotelId: number;

  @BelongsTo(() => Hotel)
  hotel: Hotel;

  // The account whose conversation triggered this, so results can be routed back
  // to the right guest and the job is attributable in an audit.
  @ForeignKey(() => Account)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'requested_by_account_id',
  })
  requestedByAccountId: number;

  @BelongsTo(() => Account)
  requestedBy: Account;

  // The chat this was asked in, so the answer can be delivered back into the same
  // conversation. Null for jobs raised outside a chat (e.g. a phone call).
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'chat_id',
  })
  chatId: number | null;

  @Column({
    type: DataType.ENUM(...Object.values(AgentJobAction)),
    allowNull: false,
  })
  action: AgentJobAction;

  @Column({
    type: DataType.JSON,
    allowNull: false,
    defaultValue: {},
  })
  params: Record<string, unknown>;

  @Column({
    type: DataType.ENUM(...Object.values(AgentJobStatus)),
    allowNull: false,
    defaultValue: AgentJobStatus.QUEUED,
  })
  status: AgentJobStatus;

  // Structured output the worker extracted. Never surfaced to a guest until
  // verifiedAt is set — the agent's own "task completed" signal proved unreliable
  // in testing (its built-in judge failed a correct answer, and it could not read
  // back its own form submission).
  @Column({
    type: DataType.JSON,
    allowNull: true,
  })
  result: Record<string, unknown> | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  error: string | null;

  // Set only when the worker re-read the record through a second, independent
  // navigation and the value matched. Absent means "the agent says it worked but
  // nothing confirmed it".
  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'verified_at',
  })
  verifiedAt: Date | null;

  // Screenshot trail for the audit log, as S3 keys.
  @Column({
    type: DataType.JSON,
    allowNull: false,
    defaultValue: [],
    field: 'screenshot_keys',
  })
  screenshotKeys: string[];

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'attempt_count',
  })
  attemptCount: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'duration_ms',
  })
  durationMs: number | null;

  // Token spend for this job, so per-hotel agent cost is attributable — a spike
  // run cost $0.008 narrow and $0.046 when it wandered.
  @Column({
    type: DataType.DECIMAL(10, 6),
    allowNull: true,
    field: 'cost_usd',
  })
  costUsd: number | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'claimed_at',
  })
  claimedAt: Date | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'finished_at',
  })
  finishedAt: Date | null;
}
