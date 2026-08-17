/**
 * Full API integration test suite.
 *
 * Prerequisites:
 *   - Backend server running on PORT from dev.env
 *   - dev.env present with all credentials
 *
 * Auth strategy:
 *   - TestingModule bootstraps OAuthModule (no HTTP server, no port conflict)
 *   - All test accounts created via AccountsService.create()
 *   - Tokens obtained via real OTP flow:
 *       emailService.sendOtp() → OTP written to DB → read back → POST /oauth/callback → real JWT
 *   - All test assets are created fresh and deleted in afterAll
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
import { RestaurantModule } from '../src/restaurant/restaurant.module';
import { AccountsService } from '../src/accounts/accounts.service';
import { BookingsService } from '../src/bookings/bookings.service';
import { HotelsService } from '../src/hotels/hotels.service';
import { RestaurantService } from '../src/restaurant/restaurant.service';
import { EmailService } from '../src/oauth/email/email.service';
import { AuthService } from '../src/auth/auth.service';
import { ConstantsService, HotelMemberStatus } from '../src/common/constants/constants.service';
import { AccountRole, Account } from '../src/accounts/accounts.model';
import { HotelAccount } from '../src/hotels/hotel-accounts.model';
import { AgentJobsModule } from '../src/agent-jobs/agent-jobs.module';
import { AgentJobsService } from '../src/agent-jobs/agent-jobs.service';
import { ChatModule } from '../src/chat/chat.module';
import { ChatService } from '../src/chat/chat.service';
import { MessagesService } from '../src/messages/messages.service';

dotenv.config({ path: path.join(__dirname, '../dev.env') });

const TAG = `ctest_${Date.now()}`;

const EMAILS = {
  admin: `${TAG}_admin@cassandratest.local`,
  owner: `${TAG}_owner@cassandratest.local`,
  staff: `${TAG}_staff@cassandratest.local`,
  guest: `${TAG}_guest@cassandratest.local`,
  pmsGuest: `${TAG}_pms_guest@cassandratest.local`,
  pmsIsolationGuest: `${TAG}_pms_isolation_guest@cassandratest.local`,
};

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  BASE_URL: '',
  adminToken: '',
  ownerToken: '',
  staffToken: '',
  guestToken: '',
  adminAccountId: 0,
  ownerAccountId: 0,
  staffAccountId: 0,
  guestAccountId: 0,
  testHotelId: 0,
  testBookingId: 0,
  testRequestId: 0,
  testMenuItemId: 0,
  adminAccount: null as Account | null,
};

// ─── Module refs ──────────────────────────────────────────────────────────────
let moduleRef: TestingModule;
let accountsService: AccountsService;
let bookingsService: BookingsService;
let hotelsService: HotelsService;
let restaurantService: RestaurantService;
let emailService: EmailService;
let authService: AuthService;
let agentJobsService: AgentJobsService;
let chatService: ChatService;
let messagesService: MessagesService;
let constantsServiceRef: ConstantsService;

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function authHeaders(token?: string) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const http = {
  get:    (url: string, token?: string) => axios.get(`${state.BASE_URL}${url}`, { headers: authHeaders(token) }),
  post:   (url: string, data: any, token?: string) => axios.post(`${state.BASE_URL}${url}`, data, { headers: authHeaders(token) }),
  patch:  (url: string, data: any, token?: string) => axios.patch(`${state.BASE_URL}${url}`, data, { headers: authHeaders(token) }),
  delete: (url: string, token?: string) => axios.delete(`${state.BASE_URL}${url}`, { headers: authHeaders(token) }),
};

async function expectStatus(expectedStatus: number, fn: () => Promise<AxiosResponse>): Promise<AxiosResponse> {
  try {
    const res = await fn();
    expect(res.status).toBe(expectedStatus);
    return res;
  } catch (e: any) {
    if (!e.response) throw e;
    expect(e.response.status).toBe(expectedStatus);
    return e.response;
  }
}

// ─── Auth helper ──────────────────────────────────────────────────────────────
/**
 * Real OTP login — no mocking, no hardcoded secrets:
 *   1. emailService.sendOtp() writes OTP to DB (email sent to cassandratest.local, bounces harmlessly)
 *   2. Read OTP from DB via accountsService
 *   3. POST /oauth/callback → running server verifies OTP → returns real JWT
 */
async function loginViaOtp(email: string): Promise<string> {
  await emailService.sendOtp(email);
  const account = await accountsService.findByUuid(`email:${email}`);
  const res = await http.post('/oauth/callback', { authType: 'email', email, otp: account!.otp });
  return res.data.token;
}

// ─── Setup ────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  // Bootstrap only the modules needed — no HTTP server spun up, no port conflict
  moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, envFilePath: path.join(__dirname, '../dev.env') }),
      OAuthModule,
      BookingsModule,
      HotelsModule,
      RestaurantModule,
      AgentJobsModule,
      ChatModule,
    ],
  }).compile();

  accountsService = moduleRef.get(AccountsService);
  bookingsService = moduleRef.get(BookingsService);
  hotelsService = moduleRef.get(HotelsService);
  restaurantService = moduleRef.get(RestaurantService);
  emailService    = moduleRef.get(EmailService);
  authService = moduleRef.get(AuthService);
  agentJobsService = moduleRef.get(AgentJobsService);
  chatService = moduleRef.get(ChatService);
  messagesService = moduleRef.get(MessagesService);
  const constantsService = moduleRef.get(ConstantsService);
  constantsServiceRef = constantsService;
  state.BASE_URL = `http://localhost:${constantsService.private.BACKEND_PORT}`;

  // Create test accounts with explicit roles
  const [adminAcc, ownerAcc, staffAcc, guestAcc] = await Promise.all([
    accountsService.create({ uuid: `email:${EMAILS.admin}`, email: EMAILS.admin, role: AccountRole.ADMIN,       oauthMeta: {} }),
    accountsService.create({ uuid: `email:${EMAILS.owner}`, email: EMAILS.owner, role: AccountRole.HOTEL_OWNER, oauthMeta: {} }),
    accountsService.create({ uuid: `email:${EMAILS.staff}`, email: EMAILS.staff, role: AccountRole.HOTEL_STAFF, oauthMeta: {} }),
    accountsService.create({ uuid: `email:${EMAILS.guest}`, email: EMAILS.guest, role: AccountRole.GUEST,       oauthMeta: {} }),
  ]);
  state.adminAccountId = adminAcc.id;
  state.adminAccount = adminAcc;
  state.ownerAccountId = ownerAcc.id;
  state.staffAccountId = staffAcc.id;
  state.guestAccountId = guestAcc.id;

  // Obtain tokens via real OTP flow (sequential — each sendOtp → read → callback)
  state.adminToken = await loginViaOtp(EMAILS.admin);
  state.ownerToken = await loginViaOtp(EMAILS.owner);
  state.staffToken = await loginViaOtp(EMAILS.staff);
  state.guestToken = await loginViaOtp(EMAILS.guest);

  // Create test hotel (admin only)
  const hotelRes = await http.post(
    '/hotels',
    { name: `Test Hotel ${TAG}`, address: '1 Test St', checkInTime: '14:00', checkOutTime: '11:00' },
    state.adminToken,
  );
  state.testHotelId = hotelRes.data.id;

  // Grant hotel access to owner and staff (creates hotel_accounts entry; role already set correctly)
  await http.post(`/hotels/${state.testHotelId}/access`, { accountId: state.ownerAccountId }, state.adminToken);
  await http.post(`/hotels/${state.testHotelId}/access`, { accountId: state.staffAccountId }, state.adminToken);

  // Create guest booking
  const bookingRes = await http.post(
    '/bookings',
    { startDate: '2026-01-01', endDate: '2026-01-07', guestEmail: EMAILS.guest, hotelId: state.testHotelId, guestName: 'Test Guest', roomNumber: '101' },
    state.adminToken,
  );
  state.testBookingId = bookingRes.data?.id ?? bookingRes.data?.data?.id;
}, 60000);

// ─── Teardown ─────────────────────────────────────────────────────────────────
afterAll(async () => {
  if (state.testHotelId && state.adminAccount) {
    await hotelsService.deleteHotel(state.testHotelId, state.adminAccount, true).catch(() => {});
  }

  await accountsService.delete({ email: EMAILS.admin }, true).catch(() => {});
  await accountsService.delete({ email: EMAILS.owner }, true).catch(() => {});
  await accountsService.delete({ email: EMAILS.staff }, true).catch(() => {});
  await accountsService.delete({ email: EMAILS.guest }, true).catch(() => {});
  await accountsService.delete({ email: EMAILS.pmsGuest }, true).catch(() => {});
  await accountsService.delete({ email: EMAILS.pmsIsolationGuest }, true).catch(() => {});

  await moduleRef.close();
  nodeHttp.globalAgent.destroy();
  nodeHttps.globalAgent.destroy();
}, 30000);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Auth', () => {
  it('GET /accounts/me with valid JWT → returns account', async () => {
    const res = await http.get('/accounts/me', state.adminToken);
    expect(res.status).toBe(200);
    expect(res.data.data.email).toBe(EMAILS.admin);
  });

  it('GET /accounts/me without token → 401', async () => {
    await expectStatus(401, () => http.get('/accounts/me'));
  });

  // These previously all answered 500. A caller could not tell a bad request from
  // a broken server, which is how a client-id mismatch during a credential
  // rotation looked like an outage.
  it('POST /oauth/callback with invalid authType → 400', async () => {
    await expectStatus(400, () =>
      http.post('/oauth/callback', { authType: 'invalid', email: EMAILS.admin }),
    );
  });

  it('POST /oauth/callback with no authType → 400', async () => {
    await expectStatus(400, () => http.post('/oauth/callback', {}));
  });

  it('POST /oauth/callback email auth missing otp → 400', async () => {
    await expectStatus(400, () => http.post('/oauth/callback', { authType: 'email', email: EMAILS.admin }));
  });

  it('POST /oauth/callback with a wrong OTP → 401, not 500', async () => {
    const res = await expectStatus(401, () =>
      http.post('/oauth/callback', { authType: 'email', email: EMAILS.admin, otp: '000000' }),
    );
    // Must not disclose whether the account exists — same answer either way.
    expect(String(res.data?.message)).toMatch(/invalid email or verification code/i);
  });

  it('POST /oauth/callback google auth missing id_token → 400', async () => {
    await expectStatus(400, () => http.post('/oauth/callback', { authType: 'google' }));
  });

  it('POST /oauth/callback with an unverifiable google id_token → 401', async () => {
    await expectStatus(401, () =>
      http.post('/oauth/callback', { authType: 'google', id_token: 'not-a-real-token' }),
    );
  });

  it('POST /oauth/email/send-otp with no email → 400', async () => {
    await expectStatus(400, () => http.post('/oauth/email/send-otp', {}));
  });
});

describe('Constants', () => {
  it('GET /constants/public → returns ACCOUNT_ROLES and PERMISSIONS (no auth required)', async () => {
    const res = await http.get('/constants/public');
    expect(res.status).toBe(200);
    expect(res.data.ACCOUNT_ROLES).toBeDefined();
    expect(res.data.PERMISSIONS).toBeDefined();
    expect(res.data.PERMISSIONS.CAN_VIEW_COSTS).toBeDefined();
    expect(res.data.PERMISSIONS.CAN_ADD_HOTEL).toBeDefined();
    expect(res.data.PERMISSIONS.CAN_MANAGE_STAFF).toBeDefined();
  });
});

describe('Accounts', () => {
  it('GET /accounts/me → returns correct role for each account type', async () => {
    const cases: [string, string][] = [
      [state.adminToken, 'admin'],
      [state.ownerToken, 'hotel_owner'],
      [state.staffToken, 'hotel_staff'],
      [state.guestToken, 'guest'],
    ];
    for (const [token, expectedRole] of cases) {
      const res = await http.get('/accounts/me', token);
      expect(res.status).toBe(200);
      const account = res.data?.data ?? res.data;
      expect(account.role).toBe(expectedRole);
    }
  });

  it('GET /accounts/me → 401 without token', async () => {
    await expectStatus(401, () => http.get('/accounts/me'));
  });

  it('PATCH /accounts/me → updates guest account', async () => {
    const res = await http.patch('/accounts/me', { name: 'Updated Guest' }, state.guestToken);
    expect(res.status).toBe(200);
  });
});

describe('Hotels', () => {
  it('GET /hotels (admin) → returns all hotels including test hotel', async () => {
    const res = await http.get('/hotels', state.adminToken);
    expect(res.status).toBe(200);
    const hotels: any[] = res.data?.data ?? res.data;
    expect(Array.isArray(hotels)).toBe(true);
    expect(hotels.some((h: any) => h.id === state.testHotelId)).toBe(true);
  });

  it('GET /hotels (hotel_owner) → returns only their hotel', async () => {
    const res = await http.get('/hotels', state.ownerToken);
    expect(res.status).toBe(200);
    const hotels: any[] = res.data?.data ?? res.data;
    expect(hotels.every((h: any) => h.id === state.testHotelId)).toBe(true);
  });

  it('GET /hotels/:id → returns hotel details', async () => {
    const res = await http.get(`/hotels/${state.testHotelId}`, state.adminToken);
    expect(res.status).toBe(200);
    expect(res.data?.id ?? res.data?.data?.id).toBe(state.testHotelId);
  });

  it('PATCH /hotels/:id (hotel_owner) → updates hotel field', async () => {
    const res = await http.patch(`/hotels/${state.testHotelId}`, { checkInTime: '15:00' }, state.ownerToken);
    expect(res.status).toBe(200);
  });

  it('POST /hotels (hotel_owner) → 201 Created (owners may create their own hotel)', async () => {
    const res = await expectStatus(201, () => http.post('/hotels', { name: `Owner Hotel ${TAG}`, address: 'Y' }, state.ownerToken));
    await hotelsService.deleteHotel(res.data.id, state.adminAccount, true).catch(() => {});
  });

  it('POST /hotels (hotel_staff) → 403 Forbidden', async () => {
    await expectStatus(403, () => http.post('/hotels', { name: 'X', address: 'Y' }, state.staffToken));
  });

  it('POST /hotels (guest) → 403 Forbidden', async () => {
    await expectStatus(403, () => http.post('/hotels', { name: 'X', address: 'Y' }, state.guestToken));
  });

  it('DELETE /hotels/:id (hotel_owner) → 403 Forbidden', async () => {
    await expectStatus(403, () => http.delete(`/hotels/${state.testHotelId}`, state.ownerToken));
  });
});

describe('Hotel Staff Management', () => {
  it('GET /hotels/:id/staff (hotel_owner) → returns members with role and status', async () => {
    const res = await http.get(`/hotels/${state.testHotelId}/staff`, state.ownerToken);
    expect(res.status).toBe(200);
    const staff: any[] = res.data?.data ?? res.data;
    expect(Array.isArray(staff)).toBe(true);
    let foundStaff = false;
    for (let i = 0; i < staff.length; i++) {
      const member = staff[i];
      if (member.id === state.staffAccountId) {
        foundStaff = true;
      }
      expect(member.role).toBeDefined();
      expect(member.status).toBeDefined();
    }
    expect(foundStaff).toBe(true);
  });

  it('GET /hotels/:id/staff (admin) → returns staff list', async () => {
    const res = await http.get(`/hotels/${state.testHotelId}/staff`, state.adminToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data?.data ?? res.data)).toBe(true);
  });

  it('GET /hotels/:id/staff (guest) → 403 Forbidden', async () => {
    await expectStatus(403, () => http.get(`/hotels/${state.testHotelId}/staff`, state.guestToken));
  });

  it('POST /hotels/:id/staff (hotel_owner) → adds a new member with selected role and pending status', async () => {
    const extraEmail = `${TAG}_extrastaff@cassandratest.local`;
    const addRes = await http.post(
      `/hotels/${state.testHotelId}/staff`,
      { email: extraEmail, role: 'hotel_owner' },
      state.ownerToken,
    );
    expect(addRes.status).toBe(201);
    expect(addRes.data?.data?.role).toBe('hotel_owner');
    expect(addRes.data?.data?.status).toBe('pending');
    const created = await accountsService.findOne({ where: { email: extraEmail } });
    if (created) {
      await accountsService.delete({ email: extraEmail }, true).catch(() => {});
    }
  });

  it('PATCH /hotels/:id/staff/:accountId/status (hotel_owner) → disables and re-activates member', async () => {
    const tempEmail = `${TAG}_tempstaff@cassandratest.local`;
    await http.post(
      `/hotels/${state.testHotelId}/staff`,
      { email: tempEmail, role: 'hotel_staff' },
      state.ownerToken,
    ).catch(() => {});
    const tempAcc = await accountsService.findOne({ where: { email: tempEmail } });
    if (tempAcc) {
      const disableRes = await http.patch(
        `/hotels/${state.testHotelId}/staff/${tempAcc.id}/status`,
        { status: 'disabled' },
        state.ownerToken,
      );
      expect(disableRes.status).toBe(200);
      expect(disableRes.data?.data?.status).toBe('disabled');
      const enableRes = await http.patch(
        `/hotels/${state.testHotelId}/staff/${tempAcc.id}/status`,
        { status: 'active' },
        state.ownerToken,
      );
      expect(enableRes.status).toBe(200);
      expect(enableRes.data?.data?.status).toBe('active');
      await accountsService.delete({ email: tempEmail }, true).catch(() => {});
    }
  });

  it('POST /invite with staff invite token → sets pending member to active', async () => {
    const pendingEmail = `${TAG}_pendingstaff@cassandratest.local`;
    await http.post(
      `/hotels/${state.testHotelId}/staff`,
      { email: pendingEmail, role: 'hotel_staff' },
      state.ownerToken,
    );
    const pendingAccount = await accountsService.findOne({ where: { email: pendingEmail } });
    expect(pendingAccount).toBeTruthy();
    if (!pendingAccount) {
      throw new Error('Pending account not created');
    }
    const hotelAccountBefore = await HotelAccount.findOne({ where: { hotelId: state.testHotelId, accountId: pendingAccount.id } });
    expect(hotelAccountBefore?.status).toBe(HotelMemberStatus.PENDING);
    const inviteToken = await authService.generateInviteToken(pendingAccount, { hotelId: state.testHotelId, type: 'staff' });
    const inviteRes = await http.post('/invite', { token: inviteToken });
    expect(inviteRes.status).toBe(201);
    const hotelAccountAfter = await HotelAccount.findOne({ where: { hotelId: state.testHotelId, accountId: pendingAccount.id } });
    expect(hotelAccountAfter?.status).toBe(HotelMemberStatus.ACTIVE);
    await accountsService.delete({ email: pendingEmail }, true).catch(() => {});
  });

  it('POST /hotels/:id/staff/import and GET /hotels/:id/staff/sample-csv work', async () => {
    const sampleRes = await http.get(`/hotels/${state.testHotelId}/staff/sample-csv`, state.ownerToken);
    expect(sampleRes.status).toBe(200);
    expect(sampleRes.data?.data?.content).toContain('email,name,role');
    const csvContent = `email,name,role\n${TAG}_csvstaff1@cassandratest.local,Csv One,hotel_staff\n${TAG}_csvowner1@cassandratest.local,Csv Owner,hotel_owner`;
    const importRes = await http.post(
      `/hotels/${state.testHotelId}/staff/import`,
      { csvContent },
      state.ownerToken,
    );
    expect(importRes.status).toBe(201);
    expect(importRes.data?.data?.imported).toBe(2);
    await accountsService.delete({ email: `${TAG}_csvstaff1@cassandratest.local` }, true).catch(() => {});
    await accountsService.delete({ email: `${TAG}_csvowner1@cassandratest.local` }, true).catch(() => {});
  });
});

describe('Bookings', () => {
  it('GET /bookings (admin) → returns array of bookings', async () => {
    const res = await http.get('/bookings', state.adminToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data?.data ?? res.data)).toBe(true);
  });

  it('GET /bookings (hotel_owner) → returns bookings scoped to their hotel', async () => {
    const res = await http.get('/bookings', state.ownerToken);
    expect(res.status).toBe(200);
    const bookings: any[] = res.data?.data ?? res.data;
    expect(Array.isArray(bookings)).toBe(true);
    expect(bookings.every((b: any) => b.hotelId === state.testHotelId)).toBe(true);
  });

  it('GET /bookings (guest) → returns only their own bookings', async () => {
    const res = await http.get('/bookings', state.guestToken);
    expect(res.status).toBe(200);
    const bookings: any[] = res.data?.data ?? res.data;
    expect(Array.isArray(bookings)).toBe(true);
    expect(bookings.every((b: any) => b.guestId === state.guestAccountId)).toBe(true);
  });

  it('GET /bookings/:id (admin) → returns booking by id', async () => {
    const res = await http.get(`/bookings/${state.testBookingId}`, state.adminToken);
    expect(res.status).toBe(200);
    expect((res.data?.data ?? res.data).id).toBe(state.testBookingId);
  });

  it('GET /bookings/:id (guest) → returns their own booking', async () => {
    const res = await http.get(`/bookings/${state.testBookingId}`, state.guestToken);
    expect(res.status).toBe(200);
  });

  it('POST /bookings (hotel_staff) → creates booking', async () => {
    const res = await http.post(
      '/bookings',
      { startDate: '2026-02-01', endDate: '2026-02-03', guestEmail: EMAILS.guest, hotelId: state.testHotelId, guestName: 'Staff Created Guest', roomNumber: '102' },
      state.staffToken,
    );
    expect(res.status).toBe(201);
    const extraBookingId = res.data?.id ?? res.data?.data?.id;
    expect(extraBookingId).toBeTruthy();
    await bookingsService.deleteBooking({ id: extraBookingId }, undefined, true).catch(() => {});
  });

  it('POST /bookings (guest) → 404 (hotel not accessible to guest)', async () => {
    await expectStatus(404, () =>
      http.post(
        '/bookings',
        { startDate: '2026-03-01', endDate: '2026-03-03', guestEmail: EMAILS.guest, hotelId: state.testHotelId, roomNumber: '103' },
        state.guestToken,
      ),
    );
  });

  it('DELETE /bookings/:id → deletes a booking (admin)', async () => {
    const res = await http.post(
      '/bookings',
      { startDate: '2026-04-01', endDate: '2026-04-02', guestEmail: EMAILS.guest, hotelId: state.testHotelId, roomNumber: '104' },
      state.adminToken,
    );
    const throwawayId = res.data?.id ?? res.data?.data?.id;
    const delRes = await http.delete(`/bookings/${throwawayId}`, state.adminToken);
    expect(delRes.status).toBe(200);
    await expectStatus(404, () => http.get(`/bookings/${throwawayId}`, state.adminToken));
    await bookingsService.deleteBooking({ id: throwawayId }, undefined, true).catch(() => {});
  });
});

describe('Requests', () => {
  it('POST /requests (guest) → creates a housekeeping request', async () => {
    const res = await http.post(
      '/requests',
      { hotelId: state.testHotelId, guestId: state.guestAccountId, bookingId: state.testBookingId, requestType: 'house_keeping', urgency: 'low', userNotes: [{ text: 'Please clean my room' }] },
      state.guestToken,
    );
    expect(res.status).toBe(201);
    state.testRequestId = res.data?.data?.id ?? res.data?.id;
    expect(state.testRequestId).toBeTruthy();
  });

  it('GET /requests (guest) → returns guest requests including created one', async () => {
    const res = await http.get('/requests', state.guestToken);
    expect(res.status).toBe(200);
    const requests: any[] = res.data?.data ?? res.data;
    expect(Array.isArray(requests)).toBe(true);
    expect(requests.some((r: any) => r.id === state.testRequestId)).toBe(true);
  });

  it('GET /requests (hotel_staff) → returns hotel requests', async () => {
    const res = await http.get('/requests', state.staffToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data?.data ?? res.data)).toBe(true);
  });

  it('GET /requests (hotel_owner) → returns hotel requests', async () => {
    const res = await http.get('/requests', state.ownerToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data?.data ?? res.data)).toBe(true);
  });

  it('PATCH /requests/:id (staff) → updates request status to completed', async () => {
    const res = await http.patch(`/requests/${state.testRequestId}`, { status: 'completed' }, state.staffToken);
    expect(res.status).toBe(200);
  });

  it('POST /requests/:id/append-message (guest) → appends user message', async () => {
    const res = await http.post(`/requests/${state.testRequestId}/append-message`, { message: 'Please also bring extra towels', role: 'user' }, state.guestToken);
    expect(res.status).toBe(201);
  });

  it('POST /requests/:id/append-message (staff) → appends staff message', async () => {
    const res = await http.post(`/requests/${state.testRequestId}/append-message`, { message: 'On it!', role: 'staff' }, state.staffToken);
    expect(res.status).toBe(201);
  });
});

describe('Restaurant', () => {
  it('POST /restaurant/menu-items (hotel_owner) → creates menu item', async () => {
    const res = await http.post(
      '/restaurant/menu-items',
      { hotelId: state.testHotelId, name: 'Burger', price: 12.99, category: 'main_course', isAvailable: true },
      state.ownerToken,
    );
    expect(res.status).toBe(201);
    state.testMenuItemId = res.data?.data?.id ?? res.data?.id;
    expect(state.testMenuItemId).toBeTruthy();
  });

  it('POST /restaurant/menu-items (hotel_staff) → creates menu item', async () => {
    const res = await http.post(
      '/restaurant/menu-items',
      { hotelId: state.testHotelId, name: 'Staff Salad', price: 8.5, category: 'appetizer', isAvailable: true },
      state.staffToken,
    );
    expect(res.status).toBe(201);
    const extraItemId = res.data?.data?.id ?? res.data?.id;
    if (state.adminAccount) {
      await restaurantService.delete(extraItemId, state.adminAccount, true).catch(() => {});
    }
  });

  it('POST /restaurant/menu-items (guest) → 404 (no hotel access)', async () => {
    await expectStatus(404, () =>
      http.post(
        '/restaurant/menu-items',
        { hotelId: state.testHotelId, name: 'Unauthorized Item', price: 5, category: 'snacks' },
        state.guestToken,
      ),
    );
  });

  it('GET /restaurant/menu-items?hotelId → returns menu items for hotel', async () => {
    const res = await http.get(`/restaurant/menu-items?hotelId=${state.testHotelId}`, state.adminToken);
    expect(res.status).toBe(200);
    const items: any[] = res.data?.data ?? res.data;
    expect(Array.isArray(items)).toBe(true);
    expect(items.some((i: any) => i.id === state.testMenuItemId)).toBe(true);
  });

  it('GET /restaurant/menu-items/:id → returns menu item by id', async () => {
    const res = await http.get(`/restaurant/menu-items/${state.testMenuItemId}`, state.adminToken);
    expect(res.status).toBe(200);
    expect((res.data?.data ?? res.data).id).toBe(state.testMenuItemId);
  });

  it('PATCH /restaurant/menu-items/:id (hotel_owner) → updates price and availability', async () => {
    const res = await http.patch(`/restaurant/menu-items/${state.testMenuItemId}`, { price: 14.99, isAvailable: false }, state.ownerToken);
    expect(res.status).toBe(200);
  });

  it('DELETE /restaurant/menu-items/:id (hotel_staff) → deletes menu item', async () => {
    const res = await http.delete(`/restaurant/menu-items/${state.testMenuItemId}`, state.staffToken);
    expect(res.status).toBe(200);
    await expectStatus(404, () => http.get(`/restaurant/menu-items/${state.testMenuItemId}`, state.adminToken));
    state.testMenuItemId = 0;
  });
});

describe('Costs', () => {
  it('GET /costs/aggregate (admin) → returns 200', async () => {
    const res = await http.get('/costs/aggregate', state.adminToken);
    expect(res.status).toBe(200);
  });

  it('GET /costs/aggregate (hotel_owner) → returns 200', async () => {
    const res = await http.get('/costs/aggregate', state.ownerToken);
    expect(res.status).toBe(200);
  });

  it('GET /costs/by-booking/:id (admin) → returns 200', async () => {
    const res = await http.get(`/costs/by-booking/${state.testBookingId}`, state.adminToken);
    expect(res.status).toBe(200);
  });

  it('GET /costs/by-hotel/:id (admin) → returns 200', async () => {
    const res = await http.get(`/costs/by-hotel/${state.testHotelId}`, state.adminToken);
    expect(res.status).toBe(200);
  });
});

describe('Notifications', () => {
  it('GET /notifications/list (admin) → returns 200 with array', async () => {
    const res = await http.get('/notifications/list', state.adminToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data?.data ?? res.data)).toBe(true);
  });

  it('GET /notifications/list (guest) → returns 200 with array', async () => {
    const res = await http.get('/notifications/list', state.guestToken);
    expect(res.status).toBe(200);
    const notifications: any[] = res.data?.data ?? res.data;
    expect(Array.isArray(notifications)).toBe(true);

    if (notifications.length > 0) {
      const notifId = notifications[0].id;
      const markRes = await http.patch(`/notifications/${notifId}/read`, {}, state.guestToken);
      expect(markRes.status).toBe(200);
    }
  });
});

describe('Permission Guards', () => {
  it('All protected routes → 401 without token', async () => {
    const routes = ['/hotels', '/bookings', '/requests', '/costs/aggregate', '/accounts/me', '/notifications/list'];
    for (const url of routes) {
      await expectStatus(401, () => http.get(url));
    }
  });

  it('POST /bookings/send-pending-invites → 403 for non-admin roles', async () => {
    await expectStatus(403, () => http.post('/bookings/send-pending-invites', {}, state.ownerToken));
    await expectStatus(403, () => http.post('/bookings/send-pending-invites', {}, state.staffToken));
    await expectStatus(403, () => http.post('/bookings/send-pending-invites', {}, state.guestToken));
  });

  it('POST /hotels → 201 for hotel_owner, 403 for staff / guest', async () => {
    const res = await expectStatus(201, () => http.post('/hotels', { name: `Owner Hotel ${TAG}`, address: 'Bad St' }, state.ownerToken));
    await hotelsService.deleteHotel(res.data.id, state.adminAccount, true).catch(() => {});
    await expectStatus(403, () => http.post('/hotels', { name: 'Bad Hotel', address: 'Bad St' }, state.staffToken));
    await expectStatus(403, () => http.post('/hotels', { name: 'Bad Hotel', address: 'Bad St' }, state.guestToken));
  });

  it('DELETE /hotels/:id → 403 for hotel_owner / staff / guest', async () => {
    await expectStatus(403, () => http.delete(`/hotels/${state.testHotelId}`, state.ownerToken));
    await expectStatus(403, () => http.delete(`/hotels/${state.testHotelId}`, state.staffToken));
    await expectStatus(403, () => http.delete(`/hotels/${state.testHotelId}`, state.guestToken));
  });

  it('POST /bookings → 404 for guest (no hotel access before role check)', async () => {
    await expectStatus(404, () =>
      http.post(
        '/bookings',
        { startDate: '2026-05-01', endDate: '2026-05-03', guestEmail: EMAILS.guest, hotelId: state.testHotelId, roomNumber: '105' },
        state.guestToken,
      ),
    );
  });
});

describe('Integrations', () => {
  // Webhook routes authenticate via Bearer <integration token>, never the
  // session JWT — so these go through raw axios rather than the http helper
  // (which always attaches a session Authorization header).
  const webhookPost = (url: string, data: any, token?: string) =>
    axios.post(`${state.BASE_URL}${url}`, data, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

  let integrationToken = '';
  let firstUpsertedBookingId = 0;

  it('POST /hotels/:hotelId/integrations/token (owner) → generates token, plaintext returned once', async () => {
    const res = await http.post(`/hotels/${state.testHotelId}/integrations/token`, {}, state.ownerToken);
    expect(res.status).toBe(201);
    const data = res.data?.data ?? res.data;
    expect(data.token).toBeTruthy();
    expect(data.status).toBe('active');
    expect(data.webhookUrls?.bookings).toContain('/integrations/v1/bookings');
    expect(data.webhookUrls?.requests).toContain('/integrations/v1/requests');
    integrationToken = data.token;
  });

  it('GET /hotels/:hotelId/integrations (owner) → returns metadata, never the plaintext token', async () => {
    const res = await http.get(`/hotels/${state.testHotelId}/integrations`, state.ownerToken);
    expect(res.status).toBe(200);
    const data = res.data?.data ?? res.data;
    expect(data.status).toBe('active');
    expect(data.tokenPrefix).toBeTruthy();
    expect(data.token).toBeUndefined();
    expect(JSON.stringify(res.data)).not.toContain(integrationToken);
  });

  it('GET /hotels/:hotelId/integrations (staff/guest) → 403', async () => {
    await expectStatus(403, () => http.get(`/hotels/${state.testHotelId}/integrations`, state.staffToken));
    await expectStatus(403, () => http.get(`/hotels/${state.testHotelId}/integrations`, state.guestToken));
  });

  it('POST /hotels/:hotelId/integrations/token (staff/guest) → 403', async () => {
    await expectStatus(403, () => http.post(`/hotels/${state.testHotelId}/integrations/token`, {}, state.staffToken));
    await expectStatus(403, () => http.post(`/hotels/${state.testHotelId}/integrations/token`, {}, state.guestToken));
  });

  it('POST /integrations/v1/bookings (valid token) → creates booking scoped to the token\'s hotel', async () => {
    const res = await webhookPost(
      '/integrations/v1/bookings',
      { externalId: `${TAG}-booking-1`, startDate: '2026-05-01', endDate: '2026-05-03', guestEmail: EMAILS.pmsGuest, guestName: 'PMS Guest', roomNumber: '900' },
      integrationToken,
    );
    expect(res.status).toBe(201);
    const data = res.data?.data ?? res.data;
    expect(data.hotelId).toBe(state.testHotelId);
    expect(data.externalId).toBe(`${TAG}-booking-1`);
    firstUpsertedBookingId = data.id;
  });

  // 200 (not 201) on re-delivery: a PMS re-sends the same reservation on every
  // change, and must be able to tell an update from a new booking by status code.
  it('POST /integrations/v1/bookings same externalId again → 200, updates the same row, no duplicate', async () => {
    const res = await webhookPost(
      '/integrations/v1/bookings',
      { externalId: `${TAG}-booking-1`, startDate: '2026-05-01', endDate: '2026-05-06', guestEmail: EMAILS.pmsGuest, roomNumber: '901' },
      integrationToken,
    );
    expect(res.status).toBe(200);
    const data = res.data?.data ?? res.data;
    expect(data.id).toBe(firstUpsertedBookingId);
    expect(data.roomNumber).toBe('901');
  });

  it('POST /integrations/v1/requests resolves bookingExternalId → creates request linked to the upserted booking', async () => {
    const res = await webhookPost(
      '/integrations/v1/requests',
      { externalId: `${TAG}-request-1`, bookingExternalId: `${TAG}-booking-1`, requestType: 'room_service', urgency: 'low' },
      integrationToken,
    );
    expect(res.status).toBe(201);
    const data = res.data?.data ?? res.data;
    expect(data.bookingId).toBe(firstUpsertedBookingId);
    expect(data.hotelId).toBe(state.testHotelId);
  });

  it('POST /integrations/v1/requests same externalId again → 200, updates the same row, no duplicate', async () => {
    const res = await webhookPost(
      '/integrations/v1/requests',
      { externalId: `${TAG}-request-1`, bookingExternalId: `${TAG}-booking-1`, requestType: 'laundry', urgency: 'high' },
      integrationToken,
    );
    expect(res.status).toBe(200);
    const data = res.data?.data ?? res.data;
    expect(data.requestType).toBe('laundry');
    expect(data.urgency).toBe('high');
  });

  it('POST /integrations/v1/requests with unknown bookingExternalId → 400', async () => {
    await expectStatus(400, () =>
      webhookPost('/integrations/v1/requests', { externalId: `${TAG}-request-bad`, bookingExternalId: 'no-such-booking', requestType: 'room_service', urgency: 'low' }, integrationToken),
    );
  });

  it('POST /integrations/v1/bookings without a token → 401', async () => {
    await expectStatus(401, () =>
      webhookPost('/integrations/v1/bookings', { externalId: 'x', startDate: '2026-01-01', endDate: '2026-01-02', guestEmail: 'x@cassandratest.local' }),
    );
  });

  it('rotating the token invalidates the old one', async () => {
    const rotateRes = await http.post(`/hotels/${state.testHotelId}/integrations/token`, {}, state.ownerToken);
    const newToken = (rotateRes.data?.data ?? rotateRes.data).token;
    expect(newToken).not.toBe(integrationToken);

    await expectStatus(401, () =>
      webhookPost('/integrations/v1/bookings', { externalId: 'old-token-test', startDate: '2026-01-01', endDate: '2026-01-02', guestEmail: 'x@cassandratest.local' }, integrationToken),
    );

    integrationToken = newToken;
  });

  it('DELETE /hotels/:hotelId/integrations/token (owner) → revokes; token then fails', async () => {
    const res = await http.delete(`/hotels/${state.testHotelId}/integrations/token`, state.ownerToken);
    expect(res.status).toBe(200);

    await expectStatus(401, () =>
      webhookPost('/integrations/v1/bookings', { externalId: 'revoked-test', startDate: '2026-01-01', endDate: '2026-01-02', guestEmail: 'x@cassandratest.local' }, integrationToken),
    );
  });

  it('a token for one hotel cannot write data under a different hotel', async () => {
    const hotelRes = await http.post('/hotels', { name: `Test Hotel B ${TAG}`, address: '2 Test St', checkInTime: '14:00', checkOutTime: '11:00' }, state.adminToken);
    const secondHotelId = hotelRes.data?.data?.id ?? hotelRes.data?.id;
    await http.post(`/hotels/${secondHotelId}/access`, { accountId: state.ownerAccountId }, state.adminToken);
    const tokenRes = await http.post(`/hotels/${secondHotelId}/integrations/token`, {}, state.ownerToken);
    const secondHotelToken = (tokenRes.data?.data ?? tokenRes.data).token;

    const res = await webhookPost(
      '/integrations/v1/bookings',
      { externalId: `${TAG}-isolation-test`, startDate: '2026-06-01', endDate: '2026-06-02', guestEmail: EMAILS.pmsIsolationGuest },
      secondHotelToken,
    );
    expect(res.status).toBe(201);
    const data = res.data?.data ?? res.data;
    expect(data.hotelId).toBe(secondHotelId);
    expect(data.hotelId).not.toBe(state.testHotelId);

    await hotelsService.deleteHotel(secondHotelId, state.adminAccount!, true).catch(() => {});
  });

  it('POST /integrations/providers/:provider/webhooks (canonical) → upserts via the envelope shape', async () => {
    // integrationToken was revoked in the previous test — generate a fresh one.
    const tokenRes = await http.post(`/hotels/${state.testHotelId}/integrations/token`, {}, state.ownerToken);
    const freshToken = (tokenRes.data?.data ?? tokenRes.data).token;

    const res = await webhookPost(
      '/integrations/providers/canonical/webhooks',
      { type: 'booking', data: { externalId: `${TAG}-canonical-1`, startDate: '2026-07-01', endDate: '2026-07-02', guestEmail: EMAILS.pmsGuest } },
      freshToken,
    );
    expect(res.status).toBe(201);
    const results = res.data?.data ?? res.data;
    expect(Array.isArray(results)).toBe(true);
    expect(results[0].hotelId).toBe(state.testHotelId);
    expect(results[0].externalId).toBe(`${TAG}-canonical-1`);

    // 'mews' is a registered adapter now, so an unknown provider needs a name
    // that will never be one.
    await expectStatus(404, () => webhookPost('/integrations/providers/not-a-real-pms/webhooks', {}, freshToken));
  });

  it('POST /integrations/providers/mews/webhooks → maps a Mews payload to bookings', async () => {
    const tokenRes = await http.post(`/hotels/${state.testHotelId}/integrations/token`, {}, state.ownerToken);
    const freshToken = (tokenRes.data?.data ?? tokenRes.data).token;

    // Real Mews Connector API shape: reservations, customers and resources arrive
    // as parallel arrays joined by id, not as one nested object.
    const mewsBody = {
      Reservations: [
        {
          Id: `${TAG}-mews-res-1`,
          Number: '102845',
          State: 'Confirmed',
          StartUtc: '2026-09-01T13:00:00Z',
          EndUtc: '2026-09-03T10:00:00Z',
          AccountId: `${TAG}-mews-cust-1`,
          AssignedResourceId: `${TAG}-mews-room-1`,
        },
        // Cancelled stays must be skipped, not upserted — our booking model has no
        // cancelled state and it must never show to a guest as active.
        {
          Id: `${TAG}-mews-res-2`,
          State: 'Canceled',
          StartUtc: '2026-09-05T13:00:00Z',
          EndUtc: '2026-09-06T10:00:00Z',
          AccountId: `${TAG}-mews-cust-1`,
        },
      ],
      Customers: [{ Id: `${TAG}-mews-cust-1`, FirstName: 'Mews', LastName: 'Guest', Email: EMAILS.pmsGuest }],
      Resources: [{ Id: `${TAG}-mews-room-1`, Name: 'SingHab02' }],
    };

    const res = await webhookPost('/integrations/providers/mews/webhooks', mewsBody, freshToken);
    expect(res.status).toBe(201);
    const results = res.data?.data ?? res.data;
    expect(results).toHaveLength(1); // the cancelled one was skipped
    expect(results[0].externalId).toBe(`${TAG}-mews-res-1`);
    expect(results[0].roomNumber).toBe('SingHab02');
    expect(results[0].hotelId).toBe(state.testHotelId);

    // Re-delivery updates the same row and answers 200, as a PMS re-sends on every change.
    const again = await webhookPost('/integrations/providers/mews/webhooks', mewsBody, freshToken);
    expect(again.status).toBe(200);
    expect((again.data?.data ?? again.data)[0].id).toBe(results[0].id);

    // A reservation we cannot join to a customer email is rejected rather than
    // guessed at — a placeholder would create junk guests attached to real stays.
    await expectStatus(400, () =>
      webhookPost(
        '/integrations/providers/mews/webhooks',
        { Reservations: [{ Id: 'x', AccountId: 'missing', StartUtc: '2026-09-01T13:00:00Z', EndUtc: '2026-09-02T10:00:00Z' }], Customers: [] },
        freshToken,
      ),
    );
  });
});

// The whole point of queueing a browser action is that the guest gets told the
// answer later. These cover what actually reaches the conversation, and — more
// importantly — what does not.
describe('Agent job chat delivery', () => {
  let workerSecret: string;
  let chatId: number;

  const workerPost = (url: string, body: any) =>
    axios.post(`${state.BASE_URL}${url}`, body, { headers: { Authorization: `Bearer ${workerSecret}` } });

  const queueJob = async (action: string) => {
    const job = await agentJobsService.enqueue(state.testHotelId, action as any, {}, state.adminAccount as any, chatId);
    const claimed = await workerPost('/agent-worker/claim', {});
    return (claimed.data?.data ?? claimed.data).id ?? job.id;
  };

  const lastAssistantMessage = async () => {
    const msgs = await messagesService.findRecentByChatId(chatId, 1);
    return msgs[0]?.content ?? '';
  };

  beforeAll(async () => {
    workerSecret = constantsServiceRef.private.AGENT_JOBS.WORKER_SECRET;
    const chat = await chatService.findOrCreateGeneralForAccount(state.adminAccount as any);
    chatId = chat.id;
  });

  it('a confirmed result is delivered into the chat with the answer', async () => {
    const id = await queueJob('pms_lookup_reservation');
    await workerPost(`/agent-worker/${id}/complete`, {
      success: true, verified: true, result: { answer: 'Room 412, arriving 10 Sep.' },
    });
    expect(await lastAssistantMessage()).toContain('Room 412');
  });

  it('an unconfirmed result never states the answer', async () => {
    const id = await queueJob('pms_list_arrivals');
    await workerPost(`/agent-worker/${id}/complete`, {
      success: true, verified: false, result: { answer: '6 arrivals' },
    });
    const content = await lastAssistantMessage();
    // The number must not reach the guest — a second read did not agree with it.
    expect(content).not.toContain('6 arrivals');
    expect(content).toMatch(/could not confirm/i);
  });

  it('a failed job says so rather than going silent', async () => {
    const id = await queueJob('pms_lookup_reservation');
    await workerPost(`/agent-worker/${id}/complete`, { success: false, error: 'TimeoutError' });
    expect(await lastAssistantMessage()).toMatch(/could not complete/i);
  });

  it('a job with no chat does not blow up completion', async () => {
    const job = await agentJobsService.enqueue(state.testHotelId, 'pms_list_arrivals' as any, {}, state.adminAccount as any, null);
    const claimed = await workerPost('/agent-worker/claim', {});
    const id = (claimed.data?.data ?? claimed.data).id ?? job.id;
    const res = await workerPost(`/agent-worker/${id}/complete`, { success: true, verified: true, result: { answer: 'x' } });
    expect(res.status).toBe(201);
  });
});

