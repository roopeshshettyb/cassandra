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
import { z } from 'zod';
import { LangGraphService, ToolCallRecord } from '../../src/langgraph/langgraph.service';
import { ConstantsService } from '../../src/common/constants/constants.service';
import { BookingsService } from '../../src/bookings/bookings.service';
import { RequestsService } from '../../src/requests/requests.service';
import { RestaurantService } from '../../src/restaurant/restaurant.service';
import { ChatService } from '../../src/chat/chat.service';
import { HotelsService } from '../../src/hotels/hotels.service';
import { AgentToolContext } from '../../src/langgraph/langgraph-tools.context';
import { buildEvalMessages } from '../../src/llm-eval/llm-eval-prompt.builder';

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
  return { requestsService, bookingsService, restaurantService, hotelsService, chatService };
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

const JUDGE_SCHEMA = z.object({ passed: z.boolean(), reasoning: z.string() });

// Reuses the same LLM-as-judge as the eval feature for the response-quality grade.
export async function judgeQuality(
  service: LangGraphService,
  userMessage: string,
  result: RunResult,
): Promise<{ passed: boolean; reasoning: string }> {
  const messages = buildEvalMessages(userMessage, result.content, result.toolCalls);
  const { parsed } = await service
    .createModel(0)
    .withStructuredOutput(z.object({ responseQuality: JUDGE_SCHEMA }), { name: 'RegressionJudge', includeRaw: true })
    .invoke(messages);
  return parsed.responseQuality;
}

// A guest account stub — tools only read account.role and account.id.
export const GUEST_ACCOUNT: any = { id: 42, role: 'guest', name: 'Test Guest', email: 'guest@test.com', uuid: 'email:guest@test.com' };

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
