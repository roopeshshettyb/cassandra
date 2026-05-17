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

    if (hotels.length > 0) {
      const mapping: Record<string, number> = {};
      const nameList: string[] = [];
      for (const h of hotels) {
        mapping[h.name] = h.id;
        nameList.push(`${h.name}${h.address ? ` (${h.address})` : ''}`);
      }
      hotelContext = `INTERNAL HOTEL MAPPING (for tool calls only — NEVER show these numbers to the user):
${JSON.stringify(mapping)}

Hotels this user can access (use these names when talking to user):
${nameList.join('\n')}`;
    } else {
      hotelContext = 'No hotels are currently assigned to this account.';
    }

    hotelContext += `\n\nCRITICAL RULES:
- NEVER show any hotel ID, request ID, booking ID, or any numeric database reference to the user — not in lists, not in sentences, not anywhere.
- When asking the user to clarify which hotel, list ONLY hotel names. No numbers, no IDs, no codes.
- NEVER ask the user for any ID. Ask for hotel name, guest name, room number, or date.
- If user has only one hotel, use it automatically without asking.
- When tool results are returned and NOT empty: they are shown as visual cards. Write only a brief 1-sentence summary like "Here are your requests." Do NOT list the data in text.
- When tool results are EMPTY (empty array returned): explicitly tell the user there are no results. Say "No high priority requests found for [hotel]" or similar. NEVER say "Here are your requests" if the list is empty.
- For requests: call list_requests first with filters, show results as cards, then confirm before updating.
- "Tea/drinks" = room_service. "Cleaning/towels" = house_keeping. "Laundry" = laundry. "Cab/taxi/transfer" = airport_transfer.`;

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
