/**
 * Socket.IO namespaces: /notifications, /chat and /voice. Covers who may connect and
 * what each refuses; nothing here sends a chat message, so no model is called.
 *
 * Same setup as api.test.ts: talks to the backend on BACKEND_PORT (npm run test:api starts it).
 * Run: npm run test:api
 */
// First: it loads the Nest modules in the order their circular references need.
import { bootstrap, httpClient, signIn, day, Session } from './helpers';
import * as nodeHttp from 'http';
import * as nodeHttps from 'https';
import { io, Socket } from 'socket.io-client';
import { TestingModule } from '@nestjs/testing';
import { AccountsService } from '../../src/accounts/accounts.service';
import { HotelsService } from '../../src/hotels/hotels.service';
import { AccountRole } from '../../src/accounts/accounts.model';
import { Chat } from '../../src/chat/chat.model';

const TAG = `stest_${Date.now()}`;
const email = (who: string) => `${TAG}_${who}@cassandratest.local`;

let moduleRef: TestingModule;
let baseUrl: string;
let admin: Session, guest: Session, stranger: Session;
let hotelId = 0,
  bookingId = 0,
  futureBookingId = 0;
const sockets: Socket[] = [];

function connect(namespace: string, query: Record<string, any> = {}): Socket {
  const socket = io(`${baseUrl}/${namespace}`, { path: '/socket.io', transports: ['websocket'], query, forceNew: true, reconnection: false });
  sockets.push(socket);
  return socket;
}

/** The first payload of `event`, failing after a timeout instead of hanging. */
function next(socket: Socket, event: string, ms = 15000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no "${event}" within ${ms}ms`)), ms);
    socket.once(event, (payload: any) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

beforeAll(async () => {
  const boot = await bootstrap();
  moduleRef = boot.moduleRef;
  baseUrl = boot.baseUrl;
  const http = httpClient(baseUrl);
  admin = await signIn(moduleRef, baseUrl, email('admin'), AccountRole.ADMIN);
  guest = await signIn(moduleRef, baseUrl, email('guest'), AccountRole.GUEST);
  stranger = await signIn(moduleRef, baseUrl, email('stranger'), AccountRole.GUEST);
  hotelId = (await http.post('/hotels', { name: `Socket Hotel ${TAG}`, address: '1 Socket St' }, admin.token)).data.id;
  // Started yesterday, so the stay window is open whatever the time of day.
  bookingId = (await http.post('/bookings', { hotelId, startDate: day(-1), endDate: day(7), guestEmail: guest.email, roomNumber: '1' }, admin.token)).data.data.id;
  futureBookingId = (await http.post('/bookings', { hotelId, startDate: day(30), endDate: day(32), guestEmail: guest.email, roomNumber: '2' }, admin.token)).data.data.id;
}, 120000);

afterEach(() => {
  while (sockets.length) sockets.pop().disconnect();
});

afterAll(async () => {
  // Removes the booking and the chats opened on it.
  const adminAccount: any = { role: AccountRole.ADMIN };
  await moduleRef
    .get(HotelsService)
    .deleteHotel(hotelId, adminAccount, true)
    .catch(() => {});
  // A socket with no booking opens a general chat, which outlives the hotel; it must go before its account.
  await Chat.destroy({ where: { accountId: [guest.id, stranger.id] }, force: true });
  await moduleRef.get(AccountsService).delete({ email: ['admin', 'guest', 'stranger'].map(email) }, true);
  await moduleRef.close();
  nodeHttp.globalAgent.destroy();
  nodeHttps.globalAgent.destroy();
}, 180000);

describe('/notifications', () => {
  it('connects with a valid token and answers ping', async () => {
    const socket = connect('notifications', { token: guest.token });
    await expect(next(socket, 'connected')).resolves.toMatchObject({ accountId: guest.id });
    socket.emit('ping', { n: 1 });
    await expect(next(socket, 'pong')).resolves.toEqual({ n: 1 });
  });

  it.each([
    ['no token', {}, 'Token required'],
    ['an invalid token', { token: 'garbage' }, 'Invalid token'],
  ])('refuses %s and disconnects', async (_name, query, message) => {
    const socket = connect('notifications', query);
    const disconnected = next(socket, 'disconnect');
    await expect(next(socket, 'error')).resolves.toEqual({ message });
    await disconnected;
  });
});

describe('/chat', () => {
  it('opens the booking chat for its guest, with history', async () => {
    const socket = connect('chat', { token: guest.token, bookingId });
    const ready = await next(socket, 'ready');
    expect(ready).toMatchObject({ chatId: expect.any(Number), messages: [] });
  });

  it('new_chat starts a different chat; open_chat goes back to the first', async () => {
    const socket = connect('chat', { token: guest.token, bookingId });
    const first = await next(socket, 'ready');
    socket.emit('new_chat');
    const second = await next(socket, 'ready');
    expect(second.chatId).not.toBe(first.chatId);
    socket.emit('open_chat', { chatId: first.chatId });
    await expect(next(socket, 'ready')).resolves.toMatchObject({ chatId: first.chatId });
  });

  it('asks for auth without a token, then accepts it as a message', async () => {
    const socket = connect('chat');
    await expect(next(socket, 'auth_required')).resolves.toBeDefined();
    socket.emit('get_chat_history');
    await expect(next(socket, 'error')).resolves.toEqual({ message: 'Not authenticated' });
    socket.emit('auth', { token: guest.token, bookingId });
    await expect(next(socket, 'ready')).resolves.toMatchObject({ chatId: expect.any(Number) });
  });

  it('refuses a booking whose stay has not started, and disconnects', async () => {
    const socket = connect('chat', { token: guest.token, bookingId: futureBookingId });
    const disconnected = next(socket, 'disconnect');
    await expect(next(socket, 'error')).resolves.toMatchObject({ code: 'OUTSIDE_STAY' });
    await disconnected;
  });

  it('refuses an invalid token and disconnects', async () => {
    const socket = connect('chat', { token: 'garbage' });
    const disconnected = next(socket, 'disconnect');
    await expect(next(socket, 'error')).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
    await disconnected;
  });

  it('refuses another guest the booking and disconnects', async () => {
    const socket = connect('chat', { token: stranger.token, bookingId });
    const disconnected = next(socket, 'disconnect');
    // The booking is outside the guest's scope, so its lookup is a NotFound, which the gateway sends as ERROR.
    await expect(next(socket, 'error')).resolves.toMatchObject({ code: 'ERROR' });
    await disconnected;
  });

  it('open_chat refuses a chat of another account', async () => {
    const owner = connect('chat', { token: guest.token, bookingId });
    const { chatId } = await next(owner, 'ready');
    const other = connect('chat', { token: stranger.token });
    await next(other, 'ready');
    other.emit('open_chat', { chatId });
    await expect(next(other, 'error')).resolves.toEqual({ message: 'Chat not found' });
  });
});

describe('/voice', () => {
  it('is ready for the booking guest', async () => {
    const socket = connect('voice', { token: guest.token, bookingId });
    await expect(next(socket, 'voice_ready')).resolves.toBeUndefined();
  });

  it('asks for auth without a token', async () => {
    await expect(next(connect('voice'), 'auth_required')).resolves.toBeDefined();
  });

  it('refuses an invalid token and disconnects', async () => {
    const socket = connect('voice', { token: 'garbage' });
    const disconnected = next(socket, 'disconnect');
    await expect(next(socket, 'error')).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
    await disconnected;
  });
});
