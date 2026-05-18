import { AllRounderSession } from './allrounder-session.interface';
import { AccountRole } from '../common/constants/constants.service';
import { ChatService } from '../chat/chat.service';

export function parseAllRounderHandshake(client: any): { token: string | null } {
  const auth: any = client.handshake?.auth;
  const token = client.handshake?.query?.token || (auth?.token ?? null);
  return { token };
}

export async function authenticateAllRounderAndInit(
  client: any,
  token: string,
  deps: {
    authService: { verifyToken: (token: string) => Promise<any> };
    hotelsService: { findAllForAccount: (account: any) => Promise<{ data: any[] }> };
    chatService: ChatService;
  },
  onSuccess: (session: AllRounderSession, recentMessages: any[]) => Promise<void>,
): Promise<void> {
  try {
    const account = await deps.authService.verifyToken(token);
    if (!account) {
      client.emit('error', { code: 'UNAUTHORIZED', message: 'Invalid token' });
      client.disconnect(true);
      return;
    }

    let scopedHotelIds: number[] | null = null;
    let hotelContext = '';

    const hotelsResult = await deps.hotelsService.findAllForAccount(account);
    const hotels: any[] = hotelsResult.data;

    if (account.role !== AccountRole.ADMIN) {
      scopedHotelIds = [];
      for (const h of hotels) scopedHotelIds.push(h.id);
    }

    if (account.role === AccountRole.GUEST) {
      hotelContext = `This is a GUEST account with potentially multiple bookings.

TOOLS TO USE:
- get_my_bookings → retrieve all guest bookings (call this for ANY question about stays, hotels, rooms, or services)
- create_guest_request → create a service request for a specific booking
- get_hotel_info → get hotel details (check-in time, WiFi, amenities) for a booking's hotel

TOOLS TO NEVER USE (they require a single active booking context which does not exist here):
- get_booking, get_hotel, create_request, update_request, get_pending_requests, append_message, search_restaurant_menu
These tools will return errors. NEVER call them.

RULES:
- ALWAYS confirm with the user before executing any action (creating a request, submitting a booking, updating anything). Say "Shall I go ahead and [action]?" and wait for confirmation. Only call the tool after user confirms with yes/ok/go ahead.
- ALWAYS call get_my_bookings first before answering ANY question about the guest's stay.
- NEVER say "you don't have an active booking" — always check with get_my_bookings.
- After get_my_bookings, follow these rules for service requests:
  1. If user says "all my active bookings" or "all rooms": create request for every booking where isActive=true — call create_guest_request once per active booking, no need to ask.
  2. If user names specific rooms/hotels (e.g. "Room 217 and Room 416"): create request for each mentioned booking — match by roomNumber or hotel name.
  3. If user says "my booking" or "my stay" without specifying and there is exactly ONE active booking: use it automatically, do NOT ask.
  4. If user says "my booking" and there are MULTIPLE active bookings: list them as numbered options and ask which one(s) they want — e.g. "Which booking(s)?\n1. Marriott (no room)\n2. The Lodhi · Room 217". User can reply "1", "2", "1 and 2", etc.
- Once you know the bookingId(s), call create_guest_request immediately. Do NOT call get_my_bookings again.
- For past bookings: show all returned bookings — they include past stays too.
- NEVER show booking IDs — use hotel names and room numbers only.
- A booking with no roomNumber → refer to it by hotel name only (e.g. "your Marriott booking").
- "Tea/drinks" = room_service. "Cleaning/towels" = house_keeping. "Laundry" = laundry. "Cab/taxi/transfer" = airport_transfer.`;
    } else if (hotels.length > 0) {
      const mapping: Record<string, number> = {};
      const nameList: string[] = [];
      for (const h of hotels) {
        const displayKey = h.address ? `${h.name} (${h.address})` : h.name;
        mapping[displayKey] = h.id;
        nameList.push(displayKey);
      }
      hotelContext = `INTERNAL HOTEL MAPPING (for tool calls only — NEVER show these numbers to the user):
${JSON.stringify(mapping)}

Hotels this user can access (use these names when talking to user):
${nameList.join('\n')}

═══ MANDATORY HOTEL DISAMBIGUATION ═══
BEFORE calling ANY tool that requires a hotelId: you MUST confirm the exact hotel.
- If user gives a partial/ambiguous name (e.g. "radisson", "marriott"): scan the hotel list above, find ALL hotels whose name contains that word, STOP — do NOT call any tool yet.
- If more than 15 hotels match: reply "There are many hotels matching that name. Could you type a more specific name or city?"
- Otherwise reply in this EXACT format (one hotel per line, MANDATORY):
I found N hotels matching "[word]":
1. Hotel Name (Address)
2. Hotel Name (Address)
Which one do you mean?
- OUTPUT FORMAT IS MANDATORY: one numbered item per line. NEVER comma-separated. NEVER "Please choose from: A, B, C".
- NEVER silently pick one. NEVER call a tool when hotel is ambiguous.
- Only call the tool AFTER the user picks a specific option from your numbered list.
- If user has only one hotel total → use it automatically.
- If user's message already matches exactly one hotel name in the list → use it automatically.
- If user asks for stats without specifying a hotel and there are more than 5 hotels → ask "Which hotel would you like stats for?" (do NOT list all hotels — wait for them to type a name).

═══ CRITICAL RULES ═══
- ALWAYS confirm before any write action (create booking, create request, update request, update hotel). Say "Shall I go ahead and [action]?" and wait for user to confirm. Only call the tool after confirmation.
- NEVER show any hotel ID, request ID, booking ID, or any numeric database reference to the user.
- NEVER ask the user for any ID. Ask for hotel name, guest name, room number, or date.
- When tool results are NOT empty: UI shows visual cards. Your text = ONE short sentence only (e.g. "Here are the stats for [hotel name]."). NEVER list data in text when cards are present.
- When tool results are EMPTY: tell user explicitly ("No pending requests found for [hotel]."). NEVER say "Here are your requests" when list is empty.
- For requests: call list_requests first with filters, show cards, confirm before updating.
- When user asks for "stats", "overview", "dashboard", "summary" → ALWAYS call get_hotel_stats, NOT list_requests.
- "Tea/drinks" = room_service. "Cleaning/towels" = house_keeping. "Laundry" = laundry. "Cab/taxi/transfer" = airport_transfer.`;
    } else {
      hotelContext = 'No hotels are currently assigned to this account.';
    }

    const chat = await deps.chatService.findOrCreateAllRounderChat(account.id);
    const recentMessages = await deps.chatService.getAllRounderMessages(chat.id, 50);

    const session: AllRounderSession = { account, scopedHotelIds, chatId: chat.id, hotelContext };
    client.session = session;
    delete client.sessionPending;
    await onSuccess(session, recentMessages);
  } catch (err: any) {
    client.emit('error', { code: 'ERROR', message: err?.message || 'Auth failed' });
    client.disconnect(true);
  }
}
