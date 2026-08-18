/**
 * Isolated LLM regression harness.
 *
 * Drives the real LangGraphService (real OpenRouter model call) but with all
 * domain services mocked, so no DB is touched. Tool *decisions* (which tool,
 * which args) are exercised for real; tool *effects* are canned.
 *
 * Assertions are hybrid: deterministic checks (tool called, args, must-include/
 * exclude substrings) plus the LLM-as-judge for response quality.
 */
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';
import { LangGraphService, ToolCallRecord } from '../../src/langgraph/langgraph.service';
import { ConstantsService } from '../../src/common/constants/constants.service';
import { BookingsService } from '../../src/bookings/bookings.service';
import { RequestsService } from '../../src/requests/requests.service';
import { RestaurantService } from '../../src/restaurant/restaurant.service';
import { ChatService } from '../../src/chat/chat.service';
import { HotelsService } from '../../src/hotels/hotels.service';
import { AgentJobsService } from '../../src/agent-jobs/agent-jobs.service';
import { AgentJobStatus } from '../../src/agent-jobs/agent-jobs.model';
import { AgentToolContext } from '../../src/langgraph/langgraph-tools.context';
import { judgeTurn } from '../../src/llm-eval/llm-eval.judge';

// ── Canned fixtures the mocked tools/context return ──────────────────────────
export const TEST_HOTEL = {
  id: 1,
  name: 'The Grand Test Hotel',
  address: '1 Test Street, Test City',
  checkInTime: '14:00',
  checkOutTime: '11:00',
  restaurantHours: '07:30-22:30',
  breakfastHours: '07:00-10:30',
  poolHours: '06:00-21:00',
  gymHours: '05:00-23:00',
  wifiPassword: 'GrandTest2026',
  phoneNumber: '+1-555-0100',
};

export const TEST_BOOKING = {
  id: 555,
  hotelId: 1,
  guestId: 42,
  roomNumber: '902',
  startTime: '2026-06-01T14:00:00.000Z',
  endTime: '2026-12-31T11:00:00.000Z',
  hotel: TEST_HOTEL,
};

export const TEST_MENU = [
  { id: 1, name: 'Paneer Tikka', description: 'Grilled cottage cheese', price: 350, category: 'Starters', dietaryTags: ['vegetarian'] },
  { id: 2, name: 'Butter Chicken', description: 'Creamy tomato curry', price: 480, category: 'Mains', dietaryTags: [] },
];

const ok = (data: unknown, message: string | null = null) => ({ success: true, message, data });

// Mocks return success-shaped payloads so the agent loop proceeds without a DB.
function buildMocks() {
  const requestsService: any = {
    create: jest.fn(async (dto: any) => ok({ id: 999, status: 'pending', ...dto }, 'Request created')),
    update: jest.fn(async (id: number, rest: any) => ok({ id, ...rest }, 'Request updated')),
    findForAccountWithOptions: jest.fn(async () => ok([{ id: 1, requestType: 'house_keeping', status: 'pending', urgency: 'medium', userNotes: [], createdAt: new Date().toISOString() }])),
    appendUserMessage: jest.fn(async () => ok({}, 'Note added')),
    appendStaffMessage: jest.fn(async () => ok({}, 'Note added')),
  };
  const bookingsService: any = {
    findForAccountWithOptions: jest.fn(async () => ok([TEST_BOOKING])),
    findByIdForAccount: jest.fn(async () => ok(TEST_BOOKING)),
  };
  const restaurantService: any = {
    searchMenuItems: jest.fn(async () => ok(TEST_MENU)),
  };
  const hotelsService: any = {
    findAllForAccount: jest.fn(async () => ok([TEST_HOTEL])),
  };
  const chatService: any = {
    setBookingForChat: jest.fn(async () => undefined),
    updateLanguageCode: jest.fn(async () => undefined),
  };
  // The browser-agent tools only need the queue to answer; no browser is driven in
  // a regression run. A queued job comes back not-reportable, which is what a real
  // in-flight job looks like — so the agent is exercised on the "don't claim it's
  // done yet" path rather than against a fabricated success.
  const agentJobsService: any = {
    enqueue: jest.fn(async () => ({ id: 1, status: AgentJobStatus.QUEUED })),
    findByIdForAccount: jest.fn(async () => ({ id: 1, status: AgentJobStatus.QUEUED, verifiedAt: null, result: null, error: null })),
    buildAgentFacingStatus: jest.fn((job: any) => ({ jobId: job.id, status: job.status, reportable: false })),
  };
  return { requestsService, bookingsService, restaurantService, hotelsService, chatService, agentJobsService };
}

export interface Harness {
  service: LangGraphService;
  close: () => Promise<void>;
}

export async function buildHarness(): Promise<Harness> {
  const mocks = buildMocks();
  const ref = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: path.resolve(__dirname, '../../dev.env') })],
    providers: [
      LangGraphService,
      ConstantsService,
      { provide: BookingsService, useValue: mocks.bookingsService },
      { provide: RequestsService, useValue: mocks.requestsService },
      { provide: RestaurantService, useValue: mocks.restaurantService },
      { provide: ChatService, useValue: mocks.chatService },
      { provide: HotelsService, useValue: mocks.hotelsService },
      { provide: AgentJobsService, useValue: mocks.agentJobsService },
    ],
  }).compile();

  return { service: ref.get(LangGraphService), close: () => ref.close() };
}

export interface RunResult {
  content: string;
  toolCalls: ToolCallRecord[];
}

export async function runTurn(
  service: LangGraphService,
  userMessage: string,
  ctx: AgentToolContext,
  history: { role: 'user' | 'assistant' | 'system'; content: string }[] = [],
): Promise<RunResult> {
  let content = '';
  let toolCalls: ToolCallRecord[] = [];
  const messages = [...history, { role: 'user' as const, content: userMessage }];
  for await (const chunk of service.stream({ messages }, ctx)) {
    if (typeof chunk === 'string') content += chunk;
    else if (chunk && typeof chunk === 'object' && 'toolCalls' in chunk) toolCalls = chunk.toolCalls;
  }
  return { content, toolCalls };
}

// Reuses the exact same LLM-as-judge business logic as the eval feature.
export async function judgeQuality(
  service: LangGraphService,
  userMessage: string,
  result: RunResult,
): Promise<{ passed: boolean; reasoning: string }> {
  const { verdict } = await judgeTurn(service, userMessage, result.content, result.toolCalls);
  return verdict.responseQuality;
}

// A guest account stub — tools only read account.role and account.id.
export const GUEST_ACCOUNT: any = { id: 42, role: 'guest', name: 'Test Guest', email: 'guest@test.com', uuid: 'email:guest@test.com' };

export const OWNER_ACCOUNT: any = { id: 7, role: 'hotel_owner', name: 'Test Owner', email: 'owner@test.com', uuid: 'email:owner@test.com' };

/**
 * Owner-side context. The PMS tools are owner/admin only, and unlike a guest an
 * owner usually chats with no booking open — which is exactly the situation that
 * used to make request_pms_action refuse for want of a hotel.
 */
export function ownerCtx(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    account: OWNER_ACCOUNT,
    bookingId: null,
    chatId: 1,
    hotel: null,
    booking: null,
    languageCode: 'en',
    ...overrides,
  };
}

export function guestCtx(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    account: GUEST_ACCOUNT,
    bookingId: TEST_BOOKING.id,
    chatId: 1,
    hotel: TEST_HOTEL,
    booking: TEST_BOOKING,
    languageCode: 'en',
    ...overrides,
  };
}
