/**
 * Rooms & Inventory API tests (Trello #77).
 *
 * Same setup as api.test.ts: needs the backend already listening on BACKEND_PORT,
 * logs in through the real OTP flow, and runs against the database in dev.env.
 * Everything it creates is tagged, and hard-deleted in afterAll.
 *
 * Run: npx cross-env NODE_ENV=automation_test jest --config jest.api.config.js --runInBand --verbose --testRegex "test/rooms\.api\.test\.ts$"
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as nodeHttp from 'http';
import * as nodeHttps from 'https';

import { OAuthModule } from '../src/oauth/oauth.module';
import { BookingsModule } from '../src/bookings/bookings.module';
import { HotelsModule } from '../src/hotels/hotels.module';
import { AccountsService } from '../src/accounts/accounts.service';
import { BookingsService } from '../src/bookings/bookings.service';
import { HotelsService } from '../src/hotels/hotels.service';
import { EmailService } from '../src/oauth/email/email.service';
import { ConstantsService, ROOM_TYPE_IMAGES_MAX_COUNT } from '../src/common/constants/constants.service';
import { AccountRole, Account } from '../src/accounts/accounts.model';
import { BookingRoom } from '../src/bookings/booking-rooms.model';

dotenv.config({ path: path.join(__dirname, '../dev.env') });

const TAG = `rtest_${Date.now()}`;

const EMAILS = {
  admin: `${TAG}_admin@cassandratest.local`,
  owner: `${TAG}_owner@cassandratest.local`,
  staff: `${TAG}_staff@cassandratest.local`,
  outsider: `${TAG}_outsider@cassandratest.local`,
  guest: `${TAG}_guest@cassandratest.local`,
  bookingGuest: `${TAG}_booking_guest@cassandratest.local`,
  pmsGuest: `${TAG}_pms_guest@cassandratest.local`,
};

const state = {
  BASE_URL: '',
  adminToken: '',
  ownerToken: '',
  staffToken: '',
  outsiderToken: '',
  guestToken: '',
  adminAccount: null as Account | null,
  hotelId: 0,
  otherHotelId: 0,
};

let moduleRef: TestingModule;
let accountsService: AccountsService;
let bookingsService: BookingsService;
let hotelsService: HotelsService;
let emailService: EmailService;

const auth = (token?: string) => (token ? { Authorization: `Bearer ${token}` } : {});
const http = {
  get: (url: string, token?: string) => axios.get(`${state.BASE_URL}${url}`, { headers: auth(token) }),
  post: (url: string, data: any, token?: string) => axios.post(`${state.BASE_URL}${url}`, data, { headers: auth(token) }),
  patch: (url: string, data: any, token?: string) => axios.patch(`${state.BASE_URL}${url}`, data, { headers: auth(token) }),
  delete: (url: string, token?: string, data?: any) => axios.delete(`${state.BASE_URL}${url}`, { headers: auth(token), data }),
};

/** Status of a request without throwing on 4xx/5xx. */
async function call(fn: () => Promise<AxiosResponse>): Promise<AxiosResponse> {
  try {
    return await fn();
  } catch (e: any) {
    if (!e.response) throw e;
    return e.response;
  }
}

async function expectStatus(expected: number, fn: () => Promise<AxiosResponse>): Promise<AxiosResponse> {
  const res = await call(fn);
  if (res.status !== expected) {
    throw new Error(`Expected ${expected}, got ${res.status}: ${JSON.stringify(res.data)}`);
  }
  return res;
}

const body = (res: AxiosResponse) => res.data?.data ?? res.data;

async function loginViaOtp(email: string): Promise<string> {
  await emailService.sendOtp(email);
  const account = await accountsService.findByUuid(`email:${email}`);
  const res = await http.post('/oauth/callback', { authType: 'email', email, otp: account!.otp });
  return res.data.token;
}

// ── Domain helpers ────────────────────────────────────────────────────────────

async function createRoomType(values: Record<string, any>, hotelId = state.hotelId, token = state.staffToken) {
  const res = await expectStatus(201, () => http.post('/rooms/types', { hotelId, maxOccupancy: 2, totalRooms: 2, ...values }, token));
  return body(res);
}

async function createRoom(roomTypeId: number, roomNumber: string) {
  const res = await expectStatus(201, () => http.post('/rooms', { roomTypeId, roomNumber }, state.staffToken));
  return body(res);
}

async function inventory(roomTypeId: number, startDate: string, endDate: string) {
  const res = await expectStatus(200, () => http.get(`/rooms/inventory?roomTypeId=${roomTypeId}&startDate=${startDate}&endDate=${endDate}`, state.staffToken));
  return body(res) as { date: string; total: number; reserved: number; blocked: number; available: number }[];
}

const reservedOn = async (roomTypeId: number, startDate: string, endDate: string) => (await inventory(roomTypeId, startDate, endDate)).map((n) => n.reserved);

function book(values: Record<string, any>, token = state.staffToken) {
  return call(() => http.post('/bookings', { hotelId: state.hotelId, guestEmail: EMAILS.bookingGuest, ...values }, token));
}

const holdsOf = (bookingId: number) => BookingRoom.findAll({ where: { bookingId }, order: [['roomId', 'ASC']] });

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  moduleRef = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: path.join(__dirname, '../dev.env') }), OAuthModule, BookingsModule, HotelsModule],
  }).compile();

  accountsService = moduleRef.get(AccountsService);
  bookingsService = moduleRef.get(BookingsService);
  hotelsService = moduleRef.get(HotelsService);
  emailService = moduleRef.get(EmailService);
  state.BASE_URL = `http://localhost:${moduleRef.get(ConstantsService).private.BACKEND_PORT}`;

  const [admin, owner, staff, outsider] = await Promise.all([
    accountsService.create({ uuid: `email:${EMAILS.admin}`, email: EMAILS.admin, role: AccountRole.ADMIN, oauthMeta: {} }),
    accountsService.create({ uuid: `email:${EMAILS.owner}`, email: EMAILS.owner, role: AccountRole.HOTEL_OWNER, oauthMeta: {} }),
    accountsService.create({ uuid: `email:${EMAILS.staff}`, email: EMAILS.staff, role: AccountRole.HOTEL_STAFF, oauthMeta: {} }),
    accountsService.create({ uuid: `email:${EMAILS.outsider}`, email: EMAILS.outsider, role: AccountRole.HOTEL_STAFF, oauthMeta: {} }),
    accountsService.create({ uuid: `email:${EMAILS.guest}`, email: EMAILS.guest, role: AccountRole.GUEST, oauthMeta: {} }),
  ]);
  state.adminAccount = admin;

  state.adminToken = await loginViaOtp(EMAILS.admin);
  state.ownerToken = await loginViaOtp(EMAILS.owner);
  state.staffToken = await loginViaOtp(EMAILS.staff);
  state.outsiderToken = await loginViaOtp(EMAILS.outsider);
  state.guestToken = await loginViaOtp(EMAILS.guest);

  const hotel = await http.post('/hotels', { name: `Rooms Hotel ${TAG}`, address: '1 Test St', checkInTime: '14:00', checkOutTime: '11:00' }, state.adminToken);
  state.hotelId = hotel.data.id;
  const other = await http.post('/hotels', { name: `Rooms Hotel B ${TAG}`, address: '2 Test St', checkInTime: '14:00', checkOutTime: '11:00' }, state.adminToken);
  state.otherHotelId = other.data.id;

  // The outsider is staff, just not at this hotel.
  await http.post(`/hotels/${state.hotelId}/access`, { accountId: owner.id }, state.adminToken);
  await http.post(`/hotels/${state.hotelId}/access`, { accountId: staff.id }, state.adminToken);
  await http.post(`/hotels/${state.otherHotelId}/access`, { accountId: outsider.id }, state.adminToken);
}, 120000);

afterAll(async () => {
  // A hotel that fails to delete is reported, not swallowed: it would otherwise sit
  // on the shared dev database with the run still showing green. Accounts are
  // swallowed as before, since some are only created by tests that ran.
  const failures: string[] = [];
  for (const id of [state.hotelId, state.otherHotelId]) {
    if (id && state.adminAccount) {
      await hotelsService.deleteHotel(id, state.adminAccount, true).catch((e) => failures.push(`hotel ${id}: ${e?.message}`));
    }
  }
  for (const email of Object.values(EMAILS)) {
    await accountsService.delete({ email }, true).catch(() => {});
  }
  await moduleRef.close();
  nodeHttp.globalAgent.destroy();
  nodeHttps.globalAgent.destroy();
  if (failures.length > 0) {
    throw new Error(`Cleanup left test data behind: ${failures.join('; ')}`);
  }
}, 60000);

// ── Room types ───────────────────────────────────────────────────────────────

describe('Room types', () => {
  let typeId = 0;

  it('POST /rooms/types (staff) → creates, ignoring properties outside the DTO', async () => {
    const created = await createRoomType({ name: 'Deluxe', perks: ['Breakfast'], images: ['https://example.com/smuggled.jpg'] });
    typeId = created.id;
    expect(created.hotelId).toBe(state.hotelId);
    expect(created.perks).toEqual(['Breakfast']);
    expect(created.images).toEqual([]);
  });

  it('POST /rooms/types → 400 on missing name or occupancy below 1', async () => {
    await expectStatus(400, () => http.post('/rooms/types', { hotelId: state.hotelId, maxOccupancy: 2, totalRooms: 1 }, state.staffToken));
    await expectStatus(400, () => http.post('/rooms/types', { hotelId: state.hotelId, name: 'X', maxOccupancy: 0, totalRooms: 1 }, state.staffToken));
  });

  it('POST /rooms/types → 404 for a staff member of another hotel, and for a guest', async () => {
    await expectStatus(404, () => http.post('/rooms/types', { hotelId: state.hotelId, name: 'X', maxOccupancy: 2, totalRooms: 1 }, state.outsiderToken));
    await expectStatus(404, () => http.post('/rooms/types', { hotelId: state.hotelId, name: 'X', maxOccupancy: 2, totalRooms: 1 }, state.guestToken));
  });

  it('GET /rooms/types → lists for members, 404 for outsiders, 401 without a token', async () => {
    const res = await expectStatus(200, () => http.get(`/rooms/types?hotelId=${state.hotelId}`, state.ownerToken));
    expect(body(res).some((t: any) => t.id === typeId)).toBe(true);
    await expectStatus(404, () => http.get(`/rooms/types?hotelId=${state.hotelId}`, state.outsiderToken));
    await expectStatus(401, () => http.get(`/rooms/types?hotelId=${state.hotelId}`));
  });

  it('PATCH /rooms/types/:id → updates, and cannot move the type to another hotel', async () => {
    const res = await expectStatus(200, () => http.patch(`/rooms/types/${typeId}`, { name: 'Deluxe King', hotelId: state.otherHotelId }, state.staffToken));
    expect(body(res).name).toBe('Deluxe King');
    expect(body(res).hotelId).toBe(state.hotelId);
  });

  it('PATCH /rooms/types/:id → 404 for an outsider', async () => {
    await expectStatus(404, () => http.patch(`/rooms/types/${typeId}`, { name: 'Hijacked' }, state.outsiderToken));
  });

  it(`images → capped at ${ROOM_TYPE_IMAGES_MAX_COUNT}, and removable`, async () => {
    for (let i = 0; i < ROOM_TYPE_IMAGES_MAX_COUNT; i++) {
      await expectStatus(201, () => http.post(`/rooms/types/${typeId}/images`, { s3Url: `https://example.com/${TAG}/${i}.jpg` }, state.staffToken));
    }
    await expectStatus(400, () => http.post(`/rooms/types/${typeId}/images`, { s3Url: `https://example.com/${TAG}/extra.jpg` }, state.staffToken));

    const removed = await expectStatus(200, () => http.delete(`/rooms/types/${typeId}/images`, state.staffToken, { s3Url: `https://example.com/${TAG}/0.jpg` }));
    expect(body(removed).images).toHaveLength(ROOM_TYPE_IMAGES_MAX_COUNT - 1);
  });

  it('POST /rooms/types/:id/images/presigned-url → returns an upload URL', async () => {
    const res = await expectStatus(201, () =>
      http.post(`/rooms/types/${typeId}/images/presigned-url`, { fileName: 'room.jpg', fileSize: 1000, contentType: 'image/jpeg' }, state.staffToken),
    );
    expect(body(res).presignedUrl).toBeTruthy();
  });

  it('DELETE /rooms/types/:id → refused while rooms exist, then removes the type and its inventory', async () => {
    const type = await createRoomType({ name: 'Doomed' });
    const room = await createRoom(type.id, `${TAG}-D1`);
    await inventory(type.id, '2031-01-01', '2031-01-03');
    await expectStatus(200, () => http.patch('/rooms/inventory', { roomTypeId: type.id, startDate: '2031-01-01', endDate: '2031-01-03', blocked: 1 }, state.staffToken));

    await expectStatus(400, () => http.delete(`/rooms/types/${type.id}`, state.staffToken));
    await expectStatus(200, () => http.delete(`/rooms/${room.id}`, state.staffToken));
    await expectStatus(200, () => http.delete(`/rooms/types/${type.id}`, state.staffToken));
    await expectStatus(404, () => http.get(`/rooms/inventory?roomTypeId=${type.id}&startDate=2031-01-01&endDate=2031-01-03`, state.staffToken));
  });
});

// ── Rooms ────────────────────────────────────────────────────────────────────

describe('Rooms', () => {
  let typeId = 0;
  let otherTypeId = 0;
  let roomId = 0;

  beforeAll(async () => {
    typeId = (await createRoomType({ name: 'Twin' })).id;
    otherTypeId = (await createRoomType({ name: 'Other hotel type' }, state.otherHotelId, state.adminToken)).id;
  });

  it('POST /rooms → creates an active room', async () => {
    const room = await createRoom(typeId, `${TAG}-101`);
    roomId = room.id;
    expect(room.status).toBe('active');
  });

  it('POST /rooms → 409 for a number already used at the hotel', async () => {
    await expectStatus(409, () => http.post('/rooms', { roomTypeId: typeId, roomNumber: `${TAG}-101` }, state.staffToken));
  });

  it('POST /rooms → stores the number trimmed, so a padded copy is still a duplicate', async () => {
    const res = await expectStatus(201, () => http.post('/rooms', { roomTypeId: typeId, roomNumber: `  ${TAG}-T1  ` }, state.staffToken));
    expect(body(res).roomNumber).toBe(`${TAG}-T1`);
    await expectStatus(409, () => http.post('/rooms', { roomTypeId: typeId, roomNumber: `${TAG}-T1 ` }, state.staffToken));
  });

  it('POST /rooms → the same number is fine at a different hotel', async () => {
    const res = await expectStatus(201, () => http.post('/rooms', { roomTypeId: otherTypeId, roomNumber: `${TAG}-101` }, state.adminToken));
    expect(body(res).hotelId).toBe(state.otherHotelId);
  });

  it('GET /rooms → lists the hotel\'s rooms with their room type', async () => {
    const rooms = body(await expectStatus(200, () => http.get(`/rooms?hotelId=${state.hotelId}`, state.staffToken)));
    expect(rooms.find((r: any) => r.id === roomId)?.roomType?.name).toBe('Twin');
  });

  it('PATCH /rooms/:id → renames, 409 onto a taken number, and cannot change the room type', async () => {
    await expectStatus(200, () => http.patch(`/rooms/${roomId}`, { roomNumber: `${TAG}-102` }, state.staffToken));
    await expectStatus(409, () => http.patch(`/rooms/${roomId}`, { roomNumber: `${TAG}-T1` }, state.staffToken));
    const res = await expectStatus(200, () => http.patch(`/rooms/${roomId}`, { roomTypeId: otherTypeId, status: 'maintenance' }, state.staffToken));
    expect(body(res).roomTypeId).toBe(typeId);
    expect(body(res).status).toBe('maintenance');
  });

  it('PATCH/DELETE /rooms/:id → 404 for an outsider', async () => {
    await expectStatus(404, () => http.patch(`/rooms/${roomId}`, { status: 'active' }, state.outsiderToken));
    await expectStatus(404, () => http.delete(`/rooms/${roomId}`, state.outsiderToken));
  });
});

// ── Inventory ────────────────────────────────────────────────────────────────

describe('Inventory', () => {
  let typeId = 0;

  beforeAll(async () => {
    typeId = (await createRoomType({ name: 'Inventory type', totalRooms: 3 })).id;
  });

  it('GET /rooms/inventory → unopened nights read as fully unsold, checkout night excluded', async () => {
    const nights = await inventory(typeId, '2031-02-01', '2031-02-04');
    expect(nights.map((n) => n.date)).toEqual(['2031-02-01', '2031-02-02', '2031-02-03']);
    expect(nights.every((n) => n.total === 3 && n.reserved === 0 && n.blocked === 0 && n.available === 3)).toBe(true);
  });

  it('PATCH /rooms/inventory → blocks and restocks a range', async () => {
    const res = await expectStatus(200, () => http.patch('/rooms/inventory', { roomTypeId: typeId, startDate: '2031-02-01', endDate: '2031-02-03', blocked: 1 }, state.staffToken));
    expect(body(res).map((n: any) => n.available)).toEqual([2, 2]);
    const restocked = await expectStatus(200, () => http.patch('/rooms/inventory', { roomTypeId: typeId, startDate: '2031-02-01', endDate: '2031-02-02', total: 5 }, state.staffToken));
    expect(body(restocked)[0]).toMatchObject({ total: 5, blocked: 1, available: 4 });
  });

  it('PATCH /rooms/inventory → 400 with neither total nor blocked, or without dates', async () => {
    await expectStatus(400, () => http.patch('/rooms/inventory', { roomTypeId: typeId, startDate: '2031-02-01', endDate: '2031-02-02' }, state.staffToken));
    await expectStatus(400, () => http.patch('/rooms/inventory', { roomTypeId: typeId, blocked: 1 }, state.staffToken));
  });

  it('date validation → empty, reversed and malformed ranges are 400', async () => {
    await expectStatus(400, () => http.get(`/rooms/inventory?roomTypeId=${typeId}&startDate=2031-02-05&endDate=2031-02-05`, state.staffToken));
    await expectStatus(400, () => http.get(`/rooms/inventory?roomTypeId=${typeId}&startDate=2031-02-05&endDate=2031-02-01`, state.staffToken));
    await expectStatus(400, () => http.get(`/rooms/inventory?roomTypeId=${typeId}&startDate=31-02-2031&endDate=2031-03-02`, state.staffToken));
  });

  it('GET /rooms/inventory → 404 for an outsider', async () => {
    await expectStatus(404, () => http.get(`/rooms/inventory?roomTypeId=${typeId}&startDate=2031-02-01&endDate=2031-02-02`, state.outsiderToken));
  });
});

// ── Availability and the next-room preview ───────────────────────────────────

describe('Availability', () => {
  let smallId = 0;
  let suiteId = 0;
  let suiteRooms: any[] = [];

  beforeAll(async () => {
    smallId = (await createRoomType({ name: `Avail small ${TAG}`, maxOccupancy: 2, totalRooms: 5 })).id;
    suiteId = (await createRoomType({ name: `Avail suite ${TAG}`, maxOccupancy: 4, totalRooms: 5 })).id;
    await createRoom(smallId, `${TAG}-S1`);
    suiteRooms = [await createRoom(suiteId, `${TAG}-Q1`), await createRoom(suiteId, `${TAG}-Q2`)];
  });

  const search = async (guests: number, rooms = 1) =>
    body(await expectStatus(200, () => http.get(`/rooms/availability?hotelId=${state.hotelId}&startDate=2031-04-01&endDate=2031-04-03&guests=${guests}&rooms=${rooms}`, state.staffToken)));

  it('only types that seat the party, capped at the physical rooms that are free', async () => {
    const forTwo = await search(2);
    expect(forTwo.find((t: any) => t.roomTypeId === smallId)?.available).toBe(1);
    expect(forTwo.find((t: any) => t.roomTypeId === suiteId)?.available).toBe(2);
    const forFour = await search(4);
    expect(forFour.some((t: any) => t.roomTypeId === smallId)).toBe(false);
  });

  it('a room out of service lowers availability', async () => {
    await expectStatus(200, () => http.patch(`/rooms/${suiteRooms[1].id}`, { status: 'out_of_service' }, state.staffToken));
    expect((await search(4)).find((t: any) => t.roomTypeId === suiteId)?.available).toBe(1);
    expect((await search(4, 2)).some((t: any) => t.roomTypeId === suiteId)).toBe(false);
    await expectStatus(200, () => http.patch(`/rooms/${suiteRooms[1].id}`, { status: 'active' }, state.staffToken));
  });

  it('GET /rooms/next-room → previews the rooms a booking would get', async () => {
    const res = await expectStatus(200, () =>
      http.get(`/rooms/next-room?roomTypeId=${suiteId}&startDate=2031-04-01&endDate=2031-04-03&rooms=2`, state.staffToken),
    );
    expect(body(res)).toEqual({ roomNumbers: [`${TAG}-Q1`, `${TAG}-Q2`], enough: true, available: 2 });
    const tooMany = body(await expectStatus(200, () => http.get(`/rooms/next-room?roomTypeId=${suiteId}&startDate=2031-04-01&endDate=2031-04-03&rooms=3`, state.staffToken)));
    expect(tooMany.enough).toBe(false);
  });

  it('GET /rooms/availability → 404 for an outsider', async () => {
    await expectStatus(404, () => http.get(`/rooms/availability?hotelId=${state.hotelId}&startDate=2031-04-01&endDate=2031-04-03&guests=1`, state.outsiderToken));
  });
});

// ── Bookings against inventory ───────────────────────────────────────────────

describe('Bookings with a room type', () => {
  let typeId = 0;
  let rooms: any[] = [];

  beforeAll(async () => {
    typeId = (await createRoomType({ name: `Booking type ${TAG}`, totalRooms: 2 })).id;
    rooms = [await createRoom(typeId, `${TAG}-B1`), await createRoom(typeId, `${TAG}-B2`)];
  });

  it('creates a booking, reserves its nights and names the rooms it holds', async () => {
    const res = await book({ startDate: '2031-05-01', endDate: '2031-05-03', roomTypeId: typeId, rooms: 2 });
    expect(res.status).toBe(201);
    const booking = body(res);
    expect(booking.roomNumber).toBe(`${TAG}-B1, ${TAG}-B2`);
    expect(booking.status).toBe('confirmed');
    expect(await reservedOn(typeId, '2031-05-01', '2031-05-04')).toEqual([2, 2, 0]);
    expect((await holdsOf(booking.id)).map((h) => h.checkIn + '/' + h.checkOut)).toEqual(['2031-05-01/2031-05-03', '2031-05-01/2031-05-03']);
    await bookingsService.deleteBooking({ id: booking.id }, undefined, true);
    expect(await reservedOn(typeId, '2031-05-01', '2031-05-03')).toEqual([0, 0]);
  });

  it('refuses to oversell and leaves nothing behind', async () => {
    const res = await book({ startDate: '2031-05-10', endDate: '2031-05-12', roomTypeId: typeId, rooms: 3 });
    expect(res.status).toBe(409);
    expect(await reservedOn(typeId, '2031-05-10', '2031-05-12')).toEqual([0, 0]);
  });

  it('refuses a same-day stay and another hotel\'s room type', async () => {
    expect((await book({ startDate: '2031-05-20', endDate: '2031-05-20', roomTypeId: typeId })).status).toBe(400);
    const foreignType = (await createRoomType({ name: 'Foreign' }, state.otherHotelId, state.adminToken)).id;
    expect((await book({ startDate: '2031-05-20', endDate: '2031-05-21', roomTypeId: foreignType })).status).toBe(404);
  });

  it('two guests racing for the last room: exactly one gets it', async () => {
    await expectStatus(200, () => http.patch('/rooms/inventory', { roomTypeId: typeId, startDate: '2031-06-01', endDate: '2031-06-02', total: 1 }, state.staffToken));
    const results = await Promise.all(Array.from({ length: 4 }, () => book({ startDate: '2031-06-01', endDate: '2031-06-02', roomTypeId: typeId })));
    const winners = results.filter((r) => r.status === 201);
    expect(winners).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(3);
    expect(await reservedOn(typeId, '2031-06-01', '2031-06-02')).toEqual([1]);
    await bookingsService.deleteBooking({ id: body(winners[0]).id }, undefined, true);
  });

  it('moving the dates moves the hold, and a failed move keeps the old dates', async () => {
    const booking = body(await book({ startDate: '2031-07-01', endDate: '2031-07-03', roomTypeId: typeId }));
    await expectStatus(200, () => http.patch(`/bookings/${booking.id}`, { startDate: '2031-07-10', endDate: '2031-07-12', roomNumber: booking.roomNumber }, state.staffToken));
    expect(await reservedOn(typeId, '2031-07-01', '2031-07-03')).toEqual([0, 0]);
    expect(await reservedOn(typeId, '2031-07-10', '2031-07-12')).toEqual([1, 1]);
    const moved = body(await http.get(`/bookings/${booking.id}`, state.staffToken));
    expect(moved.roomNumber).toBe(`${TAG}-B1`);

    // Nothing sellable on the target night: the move is refused and nothing changes.
    await expectStatus(200, () => http.patch('/rooms/inventory', { roomTypeId: typeId, startDate: '2031-07-20', endDate: '2031-07-21', blocked: 2 }, state.staffToken));
    await expectStatus(409, () => http.patch(`/bookings/${booking.id}`, { startDate: '2031-07-20', endDate: '2031-07-22', roomNumber: moved.roomNumber }, state.staffToken));
    expect(await reservedOn(typeId, '2031-07-10', '2031-07-12')).toEqual([1, 1]);
    await bookingsService.deleteBooking({ id: booking.id }, undefined, true);
  });

  it('a held room cannot be deleted, renumbered or taken out of service', async () => {
    const booking = body(await book({ startDate: '2031-08-01', endDate: '2031-08-03', roomTypeId: typeId }));
    const heldRoom = rooms[0];
    await expectStatus(400, () => http.delete(`/rooms/${heldRoom.id}`, state.staffToken));
    await expectStatus(400, () => http.patch(`/rooms/${heldRoom.id}`, { roomNumber: `${TAG}-B1-renamed` }, state.staffToken));
    await expectStatus(400, () => http.patch(`/rooms/${heldRoom.id}`, { status: 'maintenance' }, state.staffToken));
    // Resending its current values is not a change.
    await expectStatus(200, () => http.patch(`/rooms/${heldRoom.id}`, { roomNumber: heldRoom.roomNumber, status: 'active' }, state.staffToken));

    // Cancelling releases the nights and the room.
    await expectStatus(200, () => http.patch(`/bookings/${booking.id}`, { status: 'cancelled', roomNumber: booking.roomNumber }, state.staffToken));
    expect(await reservedOn(typeId, '2031-08-01', '2031-08-03')).toEqual([0, 0]);
    expect(await holdsOf(booking.id)).toHaveLength(0);
    await expectStatus(400, () => http.patch(`/bookings/${booking.id}`, { status: 'confirmed', roomNumber: booking.roomNumber }, state.staffToken));
    await expectStatus(200, () => http.patch(`/rooms/${heldRoom.id}`, { status: 'maintenance' }, state.staffToken));
    await expectStatus(200, () => http.patch(`/rooms/${heldRoom.id}`, { status: 'active' }, state.staffToken));
    await bookingsService.deleteBooking({ id: booking.id }, undefined, true);
  });

  it('deleting a booking through the API releases its nights', async () => {
    const booking = body(await book({ startDate: '2031-09-01', endDate: '2031-09-02', roomTypeId: typeId }));
    expect(await reservedOn(typeId, '2031-09-01', '2031-09-02')).toEqual([1]);
    await expectStatus(200, () => http.delete(`/bookings/${booking.id}`, state.adminToken));
    expect(await reservedOn(typeId, '2031-09-01', '2031-09-02')).toEqual([0]);
    await bookingsService.deleteBooking({ id: booking.id }, undefined, true);
  });

  it('inventory cannot be cut below what is already sold', async () => {
    const booking = body(await book({ startDate: '2031-10-01', endDate: '2031-10-02', roomTypeId: typeId, rooms: 2 }));
    await expectStatus(409, () => http.patch('/rooms/inventory', { roomTypeId: typeId, startDate: '2031-10-01', endDate: '2031-10-02', total: 1 }, state.staffToken));
    await expectStatus(409, () => http.patch('/rooms/inventory', { roomTypeId: typeId, startDate: '2031-10-01', endDate: '2031-10-02', blocked: 1 }, state.staffToken));
    expect((await inventory(typeId, '2031-10-01', '2031-10-02'))[0]).toMatchObject({ total: 2, reserved: 2, blocked: 0 });
    await bookingsService.deleteBooking({ id: booking.id }, undefined, true);
  });

  it('changing totalRooms only affects nights that have not opened yet', async () => {
    const booking = body(await book({ startDate: '2031-11-01', endDate: '2031-11-02', roomTypeId: typeId }));
    await expectStatus(200, () => http.patch(`/rooms/types/${typeId}`, { totalRooms: 5 }, state.staffToken));
    expect((await inventory(typeId, '2031-11-01', '2031-11-02'))[0].total).toBe(2);
    expect((await inventory(typeId, '2031-11-05', '2031-11-06'))[0].total).toBe(5);
    await expectStatus(200, () => http.patch(`/rooms/types/${typeId}`, { totalRooms: 2 }, state.staffToken));
    await bookingsService.deleteBooking({ id: booking.id }, undefined, true);
  });

  it('a booking with a typed room number and no room type touches no inventory', async () => {
    const res = await book({ startDate: '2031-05-01', endDate: '2031-05-01', roomNumber: 'Free text 1' });
    expect(res.status).toBe(201);
    expect(await holdsOf(body(res).id)).toHaveLength(0);
    await bookingsService.deleteBooking({ id: body(res).id }, undefined, true);
  });

  it('a different room number typed into a room-type booking is refused; the same one is fine', async () => {
    const booking = body(await book({ startDate: '2031-03-01', endDate: '2031-03-02', roomTypeId: typeId }));
    await expectStatus(400, () => http.patch(`/bookings/${booking.id}`, { roomNumber: 'Elsewhere' }, state.staffToken));
    expect(body(await http.get(`/bookings/${booking.id}`, state.staffToken)).roomNumber).toBe(booking.roomNumber);
    await expectStatus(200, () => http.patch(`/bookings/${booking.id}`, { roomNumber: booking.roomNumber, status: 'checked_in' }, state.staffToken));
    await bookingsService.deleteBooking({ id: booking.id }, undefined, true);
  });

  it('a booking needs a room type or a room number', async () => {
    const res = await book({ startDate: '2031-06-10', endDate: '2031-06-12' });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.data)).toContain('roomNumber is required when no roomTypeId is given');
    expect((await book({ startDate: '2031-06-10', endDate: '2031-06-12', roomNumber: '' })).status).toBe(400);
  });
});

// ── PMS bookings ─────────────────────────────────────────────────────────────

describe('PMS bookings', () => {
  let typeId = 0;
  let integrationToken = '';
  const webhook = (data: any) => call(() => axios.post(`${state.BASE_URL}/integrations/v1/bookings`, data, { headers: { Authorization: `Bearer ${integrationToken}` } }));

  beforeAll(async () => {
    typeId = (await createRoomType({ name: `PMS type ${TAG}`, totalRooms: 1 })).id;
    await createRoom(typeId, `${TAG}-PMS1`);
    integrationToken = body(await http.post(`/hotels/${state.hotelId}/integrations/token`, {}, state.ownerToken)).token;
  });

  it('a staff date change keeps the room the PMS chose', async () => {
    // A type of its own with two rooms. MOVE0 sorts first, so it is the room our own
    // picker would choose; the PMS sends MOVE1, which is how the two are told apart.
    const moveType = (await createRoomType({ name: `PMS move type ${TAG}`, totalRooms: 2 })).id;
    await createRoom(moveType, `${TAG}-MOVE0`);
    const pmsRoom = await createRoom(moveType, `${TAG}-MOVE1`);

    const booking = body(await webhook({ externalId: `${TAG}-pms-3`, startDate: '2032-04-01', endDate: '2032-04-02', guestEmail: EMAILS.pmsGuest, roomNumber: `${TAG}-MOVE1` }));
    await expectStatus(200, () => http.patch(`/bookings/${booking.id}`, { startDate: '2032-04-10', endDate: '2032-04-11', roomNumber: booking.roomNumber }, state.staffToken));
    const holds = await holdsOf(booking.id);
    expect(holds.map((h) => [h.roomId, h.checkIn, h.checkOut])).toEqual([[pmsRoom.id, '2032-04-10', '2032-04-11']]);
    expect(body(await http.get(`/bookings/${booking.id}`, state.staffToken)).roomNumber).toBe(`${TAG}-MOVE1`);
    expect(await reservedOn(moveType, '2032-04-01', '2032-04-02')).toEqual([0]);
    expect(await reservedOn(moveType, '2032-04-10', '2032-04-11')).toEqual([1]);
  });

  it('a PMS booking for a known room reserves its nights, and redelivery does not double it', async () => {
    const payload = { externalId: `${TAG}-pms-1`, startDate: '2032-02-01', endDate: '2032-02-03', guestEmail: EMAILS.pmsGuest, roomNumber: `${TAG}-PMS1` };
    expect((await webhook(payload)).status).toBe(201);
    expect(await reservedOn(typeId, '2032-02-01', '2032-02-03')).toEqual([1, 1]);
    expect((await webhook(payload)).status).toBe(200);
    expect(await reservedOn(typeId, '2032-02-01', '2032-02-03')).toEqual([1, 1]);
  });

  it('it is recorded even when oversold, with the night capped at full, and moving it moves the hold', async () => {
    const other = { externalId: `${TAG}-pms-2`, startDate: '2032-02-01', endDate: '2032-02-02', guestEmail: EMAILS.pmsGuest, roomNumber: `${TAG}-PMS1` };
    const res = await webhook(other);
    expect(res.status).toBe(201);
    expect(await holdsOf(body(res).id)).toHaveLength(1);
    expect((await inventory(typeId, '2032-02-01', '2032-02-02'))[0]).toMatchObject({ total: 1, reserved: 1, available: 0 });

    expect((await webhook({ ...other, startDate: '2032-03-01', endDate: '2032-03-02' })).status).toBe(200);
    expect(await reservedOn(typeId, '2032-03-01', '2032-03-02')).toEqual([1]);
    // The capped booking hands back a night it was never counted on, so the count
    // now reads low while pms-1 still holds the room...
    expect(await reservedOn(typeId, '2032-02-01', '2032-02-02')).toEqual([0]);
    // ...but the room itself is still held, so it cannot be sold to anyone else.
    const preview = body(
      await expectStatus(200, () => http.get(`/rooms/next-room?roomTypeId=${typeId}&startDate=2032-02-01&endDate=2032-02-02`, state.staffToken)),
    );
    expect(preview).toMatchObject({ roomNumbers: [], enough: false, available: 0 });
    expect((await book({ startDate: '2032-02-01', endDate: '2032-02-02', roomTypeId: typeId })).status).toBe(409);
    expect(await reservedOn(typeId, '2032-02-01', '2032-02-02')).toEqual([0]);
  });

  it('a room number we do not know holds nothing, and releases what the booking held', async () => {
    const res = await webhook({ externalId: `${TAG}-pms-1`, startDate: '2032-02-01', endDate: '2032-02-03', guestEmail: EMAILS.pmsGuest, roomNumber: 'not-a-room' });
    expect(res.status).toBe(200);
    expect(await reservedOn(typeId, '2032-02-01', '2032-02-03')).toEqual([0, 0]);
  });
});

// ── Hotel deletion ───────────────────────────────────────────────────────────

describe('Hotel deletion', () => {
  it('removes the hotel\'s room types, rooms, inventory and holds', async () => {
    const hotel = await http.post('/hotels', { name: `Rooms Hotel C ${TAG}`, address: '3 Test St' }, state.adminToken);
    const hotelId = hotel.data.id;
    const type = await createRoomType({ name: 'C type' }, hotelId, state.adminToken);
    await expectStatus(201, () => http.post('/rooms', { roomTypeId: type.id, roomNumber: 'C1' }, state.adminToken));
    const booking = body(await expectStatus(201, () => http.post('/bookings', { hotelId, guestEmail: EMAILS.bookingGuest, startDate: '2032-05-01', endDate: '2032-05-02', roomTypeId: type.id }, state.adminToken)));

    await hotelsService.deleteHotel(hotelId, state.adminAccount!, true);

    expect(await BookingRoom.count({ where: { bookingId: booking.id }, paranoid: false })).toBe(0);
    await expectStatus(404, () => http.get(`/rooms/types?hotelId=${hotelId}`, state.adminToken));
  });
});
