/**
 * Golden regression cases for the concierge agent.
 *
 * Each case sends one user turn (with optional prior history) and asserts:
 *   - toolCalled:  exact tool name the model should call, or null for "no tool"
 *   - toolArgs:    subset of args the called tool must contain (deep partial)
 *   - mustInclude / mustExclude: case-insensitive substrings in the reply
 *   - judgeQuality: when true (default), the LLM judge must pass response quality
 */
import { AgentToolContext } from '../../src/langgraph/langgraph-tools.context';
import { guestCtx } from './harness';

export interface RegressionCase {
  name: string;
  userMessage: string;
  history?: { role: 'user' | 'assistant' | 'system'; content: string }[];
  ctx?: AgentToolContext;
  expect: {
    toolCalled?: string | null;
    toolArgs?: Record<string, unknown>;
    mustInclude?: string[];
    mustExclude?: string[];
    judgeQuality?: boolean;
  };
}

export const CASES: RegressionCase[] = [
  {
    name: 'housekeeping request creates a request',
    userMessage: 'Please send two extra bath towels to my room.',
    expect: { toolCalled: 'create_request', toolArgs: { requestType: 'house_keeping' }, judgeQuality: true },
  },
  {
    name: 'airport transfer creates a request',
    userMessage: 'I need an airport pickup tomorrow at 6am for flight AI202.',
    expect: { toolCalled: 'create_request', toolArgs: { requestType: 'airport_transfer' }, judgeQuality: true },
  },
  {
    name: 'breakfast hours answered from hotel info',
    userMessage: 'What time is breakfast served?',
    expect: { toolCalled: 'get_hotel', mustInclude: ['07:00'], judgeQuality: true },
  },
  {
    name: 'wifi password answered from hotel info',
    userMessage: 'What is the wifi password?',
    expect: { toolCalled: 'get_hotel', mustInclude: ['GrandTest2026'], judgeQuality: true },
  },
  {
    name: 'checkout time answered correctly',
    userMessage: 'What time is check-out?',
    expect: { mustInclude: ['11'], mustExclude: ['14:00'], judgeQuality: true },
  },
  {
    name: 'menu search for vegetarian options',
    userMessage: 'Do you have any vegetarian food I can order?',
    expect: { toolCalled: 'search_restaurant_menu', mustInclude: ['Paneer'], judgeQuality: true },
  },
  {
    name: 'room number recalled from prior turn',
    userMessage: 'Remind me, what room am I in?',
    history: [
      { role: 'user', content: 'Hi, I just checked into room 902.' },
      { role: 'assistant', content: 'Welcome! How can I help you during your stay in room 902?' },
    ],
    expect: { mustInclude: ['902'], judgeQuality: true },
  },
  {
    name: 'language switch to Hindi',
    userMessage: 'Can we please continue this conversation in Hindi?',
    expect: { toolCalled: 'set_chat_language', toolArgs: { languageCode: 'hi' }, judgeQuality: true },
  },
  {
    name: 'out-of-scope request is declined, no booking tool misfired',
    userMessage: 'Can you book me a flight to Paris next week?',
    expect: { toolCalled: null, mustExclude: ['create_request'], judgeQuality: true },
  },
  {
    name: 'no booking context → asks to identify booking, does not fabricate',
    userMessage: 'Send a bottle of water to my room.',
    ctx: guestCtx({ bookingId: null, booking: null, hotel: null }),
    expect: { judgeQuality: true },
  },
];
