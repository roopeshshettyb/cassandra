import { AllRounderSession } from './allrounder-session.interface';
import { AccountRole } from '../common/constants/constants.service';
import { AllRounderChatService } from './allrounder-chat.service';

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
    allRounderChatService: AllRounderChatService;
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
      hotelContext = 'Hotels you have access to (use these IDs internally when calling tools — never expose IDs to the user, always refer by hotel name):\n';
      for (const h of hotels) {
        hotelContext += `  - "${h.name}" → internal ID ${h.id}${h.address ? ` (${h.address})` : ''}\n`;
      }
    } else {
      hotelContext = 'No hotels are currently assigned to this account.';
    }

    hotelContext += `\nCRITICAL RULES:
- NEVER expose database IDs (hotel ID, request ID, booking ID) to the user. Refer to everything by name, room number, or date.
- NEVER ask the user for a hotel ID, request ID, or booking ID. Ask for hotel name or guest name instead.
- You already know which hotels this user has access to (listed above). When user says "my hotel" or "the hotel", use the list above — do not ask which hotel if there is only one, or ask by NAME if there are multiple.
- For requests: call list_requests first with filters (guest name, type, status), show results, then ask user to confirm before updating.
- "Tea/drinks" = room_service. "Cleaning/towels" = house_keeping. "Laundry" = laundry. "Cab/taxi/transfer" = airport_transfer.`;

    const chat = await deps.allRounderChatService.findOrCreateForAccount(account.id);
    const recentMessages = await deps.allRounderChatService.getRecentMessages(chat.id, 50);

    const session: AllRounderSession = { account, scopedHotelIds, chatId: chat.id, hotelContext };
    client.session = session;
    delete client.sessionPending;
    await onSuccess(session, recentMessages);
  } catch (err: any) {
    client.emit('error', { code: 'ERROR', message: err?.message || 'Auth failed' });
    client.disconnect(true);
  }
}
