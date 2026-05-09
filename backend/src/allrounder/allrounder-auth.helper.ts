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
      scopedHotelIds = hotels.map((h: any) => h.id);
    }

    if (hotels.length > 0) {
      hotelContext = 'Hotels you have access to (use these IDs exactly when calling tools):\n';
      for (const h of hotels) {
        hotelContext += `  - Hotel ID ${h.id}: ${h.name}${h.address ? ` (${h.address})` : ''}\n`;
      }
    } else {
      hotelContext = 'No hotels are currently assigned to this account.';
    }

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
