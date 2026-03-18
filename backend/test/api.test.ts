/**
 * Full API integration test suite.
 *
 * Prerequisites:
 *   - Backend server running (PORT in dev.env)
 *   - dev.env present with DB credentials and JWT_SECRET
 *   - Admin account flashpactone@gmail.com exists in DB with role = admin
 *
 * Auth strategy:
 *   - All accounts use Google OAuth (no email/OTP login).
 *   - Tokens are signed directly in the test using JWT_SECRET — the JwtMiddleware
 *     only calls jwtService.verify() and uses the decoded payload as req.account,
 *     so a correctly signed token is fully accepted without any HTTP login flow.
 *   - Test accounts (owner, staff, guest) are inserted directly into the DB.
 *   - All test assets are deleted in afterAll.
 */

import axios, { AxiosResponse } from 'axios';
import { Pool } from 'pg';
import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../dev.env') });

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const TAG = `ctest_${Date.now()}`;

const EMAILS = {
  admin: 'flashpactone@gmail.com',
  owner: `${TAG}_owner@cassandratest.local`,
  staff: `${TAG}_staff@cassandratest.local`,
  guest: `${TAG}_guest@cassandratest.local`,
};

// ─── Shared state ─────────────────────────────────────────────────────────────
let db: Pool;
let adminToken: string;
let ownerToken: string;
let staffToken: string;
let guestToken: string;
let adminAccountId: number;
let ownerAccountId: number;
let staffAccountId: number;
let guestAccountId: number;
let testHotelId: number;
let testBookingId: number;
let testRequestId: number;
let testMenuItemId: number;

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function authHeaders(token?: string) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const http = {
  get:    (url: string, token?: string) => axios.get(`${BASE_URL}${url}`, { headers: authHeaders(token) }),
  post:   (url: string, data: any, token?: string) => axios.post(`${BASE_URL}${url}`, data, { headers: authHeaders(token) }),
  patch:  (url: string, data: any, token?: string) => axios.patch(`${BASE_URL}${url}`, data, { headers: authHeaders(token) }),
  delete: (url: string, token?: string) => axios.delete(`${BASE_URL}${url}`, { headers: authHeaders(token) }),
};

/** Assert a specific HTTP status even for error responses (axios throws on non-2xx). */
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

// ─── Token helper ─────────────────────────────────────────────────────────────
/** Sign a JWT with the same payload shape as AuthService.generateToken. */
function signToken(account: { id: number; uuid: string; email: string; name?: string; role: string; profilePicUrl?: string }): string {
  return jwt.sign(
    { id: account.id, uuid: account.uuid, email: account.email, name: account.name ?? null, role: account.role, profilePicUrl: account.profilePicUrl ?? null },
    JWT_SECRET,
    { expiresIn: '7d' },
  );
}

// ─── DB helpers ───────────────────────────────────────────────────────────────
/** Insert a test account and return its id. Upserts on uuid conflict. */
async function upsertAccount(email: string, role: string): Promise<{ id: number; uuid: string; email: string; role: string }> {
  const uuid = `email:${email}`;
  const { rows } = await db.query<{ id: number; uuid: string; email: string; role: string }>(
    `INSERT INTO accounts (uuid, email, role, oauth_meta, created_at, updated_at)
     VALUES ($1, $2, $3, '{}', NOW(), NOW())
     ON CONFLICT (uuid) DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()
     RETURNING id, uuid, email, role`,
    [uuid, email, role],
  );
  return rows[0];
}

// ─── Setup ────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  db = new Pool({
    host:     process.env.DB_HOST,
    port:     Number(process.env.DB_PORT || 5432),
    user:     process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  // 1. Admin — fetch existing account from DB, sign token directly
  const { rows: adminRows } = await db.query('SELECT id, uuid, email, name, role FROM accounts WHERE email = $1', [EMAILS.admin]);
  const adminAccount = adminRows[0];
  adminAccountId = adminAccount.id;
  adminToken = signToken(adminAccount);

  // 2. Admin creates test hotel via API
  const hotelRes = await http.post(
    '/hotels',
    { name: `Test Hotel ${TAG}`, address: '1 Test St', checkInTime: '14:00', checkOutTime: '11:00' },
    adminToken,
  );
  testHotelId = hotelRes.data.id;

  // 3. Hotel owner — insert into DB with hotel_owner role, grant hotel access, sign token
  const ownerAccount = await upsertAccount(EMAILS.owner, 'hotel_owner');
  ownerAccountId = ownerAccount.id;
  await http.post(`/hotels/${testHotelId}/access`, { accountId: ownerAccountId }, adminToken);
  ownerToken = signToken(ownerAccount);

  // 4. Hotel staff — insert into DB with hotel_staff role, create HotelAccount link, sign token
  const staffAccount = await upsertAccount(EMAILS.staff, 'hotel_staff');
  staffAccountId = staffAccount.id;
  await db.query(
    'INSERT INTO hotel_accounts (hotel_id, account_id, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) ON CONFLICT DO NOTHING',
    [testHotelId, staffAccountId],
  );
  staffToken = signToken(staffAccount);

  // 5. Guest — insert into DB, sign token, admin creates booking
  const guestAccount = await upsertAccount(EMAILS.guest, 'guest');
  guestAccountId = guestAccount.id;
  guestToken = signToken(guestAccount);

  const bookingRes = await http.post(
    '/bookings',
    { startDate: '2026-01-01', endDate: '2026-01-07', guestEmail: EMAILS.guest, hotelId: testHotelId, guestName: 'Test Guest' },
    adminToken,
  );
  testBookingId = bookingRes.data?.id ?? bookingRes.data?.data?.id;
}, 60000);

// ─── Teardown ─────────────────────────────────────────────────────────────────
afterAll(async () => {
  // Requests are not cascade-deleted when booking is deleted — remove them first
  if (testBookingId) {
    await db.query('DELETE FROM requests WHERE booking_id = $1', [testBookingId]).catch(() => {});
  }

  // Delete test hotel via API (cascades: bookings, hotel_accounts, menu_items)
  if (testHotelId && adminToken) {
    await http.delete(`/hotels/${testHotelId}`, adminToken).catch(() => {});
  }

  // Delete test accounts
  for (const email of [EMAILS.owner, EMAILS.staff, EMAILS.guest]) {
    await db.query('DELETE FROM accounts WHERE email = $1', [email]).catch(() => {});
  }

  await db.end().catch(() => {});
}, 30000);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Auth', () => {
  it('GET /accounts/me with valid JWT → returns account', async () => {
    const res = await http.get('/accounts/me', adminToken);
    expect(res.status).toBe(200);
    expect(res.data.data.email).toBe(EMAILS.admin);
  });

  it('GET /accounts/me without token → 401', async () => {
    await expectStatus(401, () => http.get('/accounts/me'));
  });

  it('POST /oauth/callback with invalid authType → error', async () => {
    await expectStatus(500, () =>
      http.post('/oauth/callback', { authType: 'invalid', email: EMAILS.admin }),
    );
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
      [adminToken, 'admin'],
      [ownerToken, 'hotel_owner'],
      [staffToken, 'hotel_staff'],
      [guestToken, 'guest'],
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

  it('PATCH /accounts/me → updates guest name', async () => {
    const res = await http.patch('/accounts/me', { name: 'Guest Updated' }, guestToken);
    expect(res.status).toBe(200);
  });
});

describe('Hotels', () => {
  it('GET /hotels (admin) → returns all hotels including test hotel', async () => {
    const res = await http.get('/hotels', adminToken);
    expect(res.status).toBe(200);
    const hotels: any[] = res.data?.data ?? res.data;
    expect(Array.isArray(hotels)).toBe(true);
    expect(hotels.some(h => h.id === testHotelId)).toBe(true);
  });

  it('GET /hotels (hotel_owner) → returns only their hotel', async () => {
    const res = await http.get('/hotels', ownerToken);
    expect(res.status).toBe(200);
    const hotels: any[] = res.data?.data ?? res.data;
    expect(hotels.every(h => h.id === testHotelId)).toBe(true);
  });

  it('GET /hotels/:id → returns hotel details', async () => {
    const res = await http.get(`/hotels/${testHotelId}`, adminToken);
    expect(res.status).toBe(200);
    const hotel = res.data?.data ?? res.data;
    expect(hotel.id).toBe(testHotelId);
  });

  it('PATCH /hotels/:id (hotel_owner) → updates hotel field', async () => {
    const res = await http.patch(`/hotels/${testHotelId}`, { poolHours: '08:00 - 20:00' }, ownerToken);
    expect(res.status).toBe(200);
    const hotel = res.data?.data ?? res.data;
    expect(hotel.poolHours).toBe('08:00 - 20:00');
  });

  it('POST /hotels (hotel_owner) → 403 Forbidden', async () => {
    await expectStatus(403, () =>
      http.post('/hotels', { name: 'Unauthorized Hotel', address: '0 Bad St' }, ownerToken),
    );
  });

  it('POST /hotels (hotel_staff) → 403 Forbidden', async () => {
    await expectStatus(403, () =>
      http.post('/hotels', { name: 'Unauthorized Hotel', address: '0 Bad St' }, staffToken),
    );
  });

  it('POST /hotels (guest) → 403 Forbidden', async () => {
    await expectStatus(403, () =>
      http.post('/hotels', { name: 'Unauthorized Hotel', address: '0 Bad St' }, guestToken),
    );
  });

  it('DELETE /hotels/:id (hotel_owner) → 403 Forbidden', async () => {
    await expectStatus(403, () => http.delete(`/hotels/${testHotelId}`, ownerToken));
  });
});

describe('Hotel Staff Management', () => {
  let tempStaffId: number | undefined;

  it('GET /hotels/:id/staff (hotel_owner) → returns staff list containing test staff', async () => {
    const res = await http.get(`/hotels/${testHotelId}/staff`, ownerToken);
    expect(res.status).toBe(200);
    const staff: any[] = res.data?.data ?? res.data;
    expect(Array.isArray(staff)).toBe(true);
    expect(staff.some(s => s.id === staffAccountId)).toBe(true);
  });

  it('GET /hotels/:id/staff (admin) → returns staff list', async () => {
    const res = await http.get(`/hotels/${testHotelId}/staff`, adminToken);
    expect(res.status).toBe(200);
  });

  it('GET /hotels/:id/staff (guest) → 403 Forbidden', async () => {
    await expectStatus(403, () => http.get(`/hotels/${testHotelId}/staff`, guestToken));
  });

  it('POST /hotels/:id/staff (hotel_owner) → adds a new staff member (SMTP may fail)', async () => {
    const tempEmail = `${TAG}_staff2@gmail.com`;
    // Catch SMTP 500 — account and HotelAccount are still created before email send
    let res: any;
    try {
      res = await http.post(`/hotels/${testHotelId}/staff`, { email: tempEmail }, ownerToken);
    } catch (e: any) {
      res = e.response;
    }
    expect([201, 500]).toContain(res.status);
    // Account should exist in DB even if email failed
    const { rows } = await db.query('SELECT id FROM accounts WHERE email = $1', [tempEmail]);
    tempStaffId = rows[0]?.id;
    expect(tempStaffId).toBeTruthy();
  });

  it('DELETE /hotels/:id/staff/:accountId (hotel_owner) → revokes staff access', async () => {
    if (!tempStaffId) return;
    const res = await http.delete(`/hotels/${testHotelId}/staff/${tempStaffId}`, ownerToken);
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    await db.query('DELETE FROM accounts WHERE id = $1', [tempStaffId]).catch(() => {});
  });
});

describe('Bookings', () => {
  it('GET /bookings (admin) → returns array of bookings', async () => {
    const res = await http.get('/bookings', adminToken);
    expect(res.status).toBe(200);
    const bookings: any[] = res.data?.data ?? res.data;
    expect(Array.isArray(bookings)).toBe(true);
  });

  it('GET /bookings (hotel_owner) → returns bookings scoped to their hotel', async () => {
    const res = await http.get('/bookings', ownerToken);
    expect(res.status).toBe(200);
    const bookings: any[] = res.data?.data ?? res.data;
    expect(Array.isArray(bookings)).toBe(true);
    expect(bookings.some(b => b.id === testBookingId)).toBe(true);
  });

  it('GET /bookings (guest) → returns only their own bookings', async () => {
    const res = await http.get('/bookings', guestToken);
    expect(res.status).toBe(200);
    const bookings: any[] = res.data?.data ?? res.data;
    expect(bookings.some(b => b.id === testBookingId)).toBe(true);
  });

  it('GET /bookings/:id (admin) → returns booking by id', async () => {
    const res = await http.get(`/bookings/${testBookingId}`, adminToken);
    expect(res.status).toBe(200);
    const booking = res.data?.data ?? res.data;
    expect(booking.id).toBe(testBookingId);
  });

  it('GET /bookings/:id (guest) → returns their own booking', async () => {
    const res = await http.get(`/bookings/${testBookingId}`, guestToken);
    expect(res.status).toBe(200);
  });

  it('POST /bookings (hotel_staff) → creates booking', async () => {
    const res = await http.post(
      '/bookings',
      {
        startDate:  '2026-02-01',
        endDate:    '2026-02-03',
        guestEmail: EMAILS.guest,
        hotelId:    testHotelId,
        guestName:  'Staff Created Guest',
      },
      staffToken,
    );
    expect(res.status).toBe(201);
    const extraBookingId = res.data?.id ?? res.data?.data?.id;
    expect(extraBookingId).toBeTruthy();
    await db.query('DELETE FROM bookings WHERE id = $1', [extraBookingId]).catch(() => {});
  });

  it('POST /bookings (guest) → 404 (hotel not accessible to guest)', async () => {
    // Guest has no hotel_accounts entry → findByIdForAccount throws NotFoundException before role check
    await expectStatus(404, () =>
      http.post(
        '/bookings',
        { startDate: '2026-03-01', endDate: '2026-03-03', guestEmail: EMAILS.guest, hotelId: testHotelId },
        guestToken,
      ),
    );
  });

  it('DELETE /bookings/:id → deletes a booking (admin)', async () => {
    // Create a throwaway booking then delete it
    const res = await http.post(
      '/bookings',
      { startDate: '2026-04-01', endDate: '2026-04-02', guestEmail: EMAILS.guest, hotelId: testHotelId },
      adminToken,
    );
    const throwawayId = res.data?.id ?? res.data?.data?.id;
    const del = await http.delete(`/bookings/${throwawayId}`, adminToken);
    expect(del.status).toBe(200);
  });
});

describe('Requests', () => {
  it('POST /requests (guest) → creates a housekeeping request', async () => {
    const res = await http.post(
      '/requests',
      {
        hotelId:     testHotelId,
        guestId:     guestAccountId,
        bookingId:   testBookingId,
        requestType: 'house_keeping',
        urgency:     'low',
        userNotes:   [{ text: 'Please clean the room', addedAt: new Date().toISOString() }],
      },
      guestToken,
    );
    expect(res.status).toBe(201);
    testRequestId = res.data?.id ?? res.data?.data?.id;
    expect(testRequestId).toBeTruthy();
  });

  it('GET /requests (guest) → returns guest requests including created one', async () => {
    const res = await http.get('/requests', guestToken);
    expect(res.status).toBe(200);
    const requests: any[] = res.data?.data ?? res.data;
    expect(Array.isArray(requests)).toBe(true);
    expect(requests.some(r => r.id === testRequestId)).toBe(true);
  });

  it('GET /requests (hotel_staff) → returns hotel requests', async () => {
    const res = await http.get('/requests', staffToken);
    expect(res.status).toBe(200);
    const requests: any[] = res.data?.data ?? res.data;
    expect(Array.isArray(requests)).toBe(true);
  });

  it('GET /requests (hotel_owner) → returns hotel requests', async () => {
    const res = await http.get('/requests', ownerToken);
    expect(res.status).toBe(200);
  });

  it('PATCH /requests/:id (staff) → updates request status to completed', async () => {
    const res = await http.patch(`/requests/${testRequestId}`, { status: 'completed' }, staffToken);
    expect(res.status).toBe(200);
    const updated = res.data?.data ?? res.data;
    expect(updated.status).toBe('completed');
  });

  it('POST /requests/:id/append-message (guest) → appends user message', async () => {
    const res = await http.post(
      `/requests/${testRequestId}/append-message`,
      { message: 'Can you come at 10am?' },
      guestToken,
    );
    expect(res.status).toBe(201);
  });

  it('POST /requests/:id/append-message (staff) → appends staff message', async () => {
    const res = await http.post(
      `/requests/${testRequestId}/append-message`,
      { message: 'Will be there at 10am.' },
      staffToken,
    );
    expect(res.status).toBe(201);
  });
});

describe('Restaurant', () => {
  it('POST /restaurant/menu-items (hotel_owner) → creates menu item', async () => {
    const res = await http.post(
      '/restaurant/menu-items',
      { hotelId: testHotelId, name: `Test Burger ${TAG}`, price: 12.99, category: 'main_course' },
      ownerToken,
    );
    expect(res.status).toBe(201);
    testMenuItemId = res.data?.id ?? res.data?.data?.id;
    expect(testMenuItemId).toBeTruthy();
  });

  it('POST /restaurant/menu-items (hotel_staff) → creates menu item', async () => {
    const res = await http.post(
      '/restaurant/menu-items',
      { hotelId: testHotelId, name: `Test Salad ${TAG}`, price: 8.99, category: 'side' },
      staffToken,
    );
    expect(res.status).toBe(201);
    const extraItemId = res.data?.id ?? res.data?.data?.id;
    await db.query('DELETE FROM menu_items WHERE id = $1', [extraItemId]).catch(() => {});
  });

  it('POST /restaurant/menu-items (guest) → 404 (no hotel access)', async () => {
    // Guest has no hotel_accounts entry → findByIdForAccount throws NotFoundException before role check
    await expectStatus(404, () =>
      http.post(
        '/restaurant/menu-items',
        { hotelId: testHotelId, name: 'Unauthorized Item', price: 5, category: 'snacks' },
        guestToken,
      ),
    );
  });

  it('GET /restaurant/menu-items?hotelId → returns menu items for hotel', async () => {
    const res = await http.get(`/restaurant/menu-items?hotelId=${testHotelId}`, adminToken);
    expect(res.status).toBe(200);
    const items: any[] = res.data?.data ?? res.data;
    expect(Array.isArray(items)).toBe(true);
    expect(items.some(i => i.id === testMenuItemId)).toBe(true);
  });

  it('GET /restaurant/menu-items/:id → returns menu item by id', async () => {
    const res = await http.get(`/restaurant/menu-items/${testMenuItemId}`, ownerToken);
    expect(res.status).toBe(200);
  });

  it('PATCH /restaurant/menu-items/:id (hotel_owner) → updates price and availability', async () => {
    const res = await http.patch(
      `/restaurant/menu-items/${testMenuItemId}`,
      { price: 14.99, isAvailable: false },
      ownerToken,
    );
    expect(res.status).toBe(200);
    const item = res.data?.data ?? res.data;
    expect(Number(item.price)).toBe(14.99);
  });

  it('DELETE /restaurant/menu-items/:id (hotel_staff) → deletes menu item', async () => {
    const res = await http.delete(`/restaurant/menu-items/${testMenuItemId}`, staffToken);
    expect(res.status).toBe(200);
    testMenuItemId = 0; // mark as deleted so afterAll teardown skips it
  });
});

describe('Costs', () => {
  it('GET /costs/aggregate (admin) → returns 200', async () => {
    const res = await http.get('/costs/aggregate', adminToken);
    expect(res.status).toBe(200);
  });

  it('GET /costs/aggregate (hotel_owner) → returns 200', async () => {
    const res = await http.get('/costs/aggregate', ownerToken);
    expect(res.status).toBe(200);
  });

  it('GET /costs/by-booking/:id (admin) → returns 200', async () => {
    const res = await http.get(`/costs/by-booking/${testBookingId}`, adminToken);
    expect(res.status).toBe(200);
  });

  it('GET /costs/by-hotel/:id (admin) → returns 200', async () => {
    const res = await http.get(`/costs/by-hotel/${testHotelId}`, adminToken);
    expect(res.status).toBe(200);
  });
});

describe('Notifications', () => {
  it('GET /notifications (admin) → returns 200 with array', async () => {
    const res = await http.get('/notifications', adminToken);
    expect(res.status).toBe(200);
    const notifications = res.data?.data ?? res.data;
    expect(Array.isArray(notifications)).toBe(true);
  });

  it('GET /notifications (guest) → returns 200 with array', async () => {
    const res = await http.get('/notifications', guestToken);
    expect(res.status).toBe(200);
    const notifications: any[] = res.data?.data ?? res.data;
    expect(Array.isArray(notifications)).toBe(true);

    if (notifications.length > 0) {
      const notifId = notifications[0].id;
      const markRes = await http.patch(`/notifications/${notifId}/read`, {}, guestToken);
      expect(markRes.status).toBe(200);
    }
  });
});

describe('Permission Guards', () => {
  it('All protected routes → 401 without token', async () => {
    const routes = ['/hotels', '/bookings', '/requests', '/costs/aggregate', '/accounts/me', '/notifications'];
    for (const url of routes) {
      await expectStatus(401, () => http.get(url));
    }
  });

  it('POST /bookings/send-pending-invites → 403 for non-admin roles', async () => {
    await expectStatus(403, () => http.post('/bookings/send-pending-invites', {}, ownerToken));
    await expectStatus(403, () => http.post('/bookings/send-pending-invites', {}, staffToken));
    await expectStatus(403, () => http.post('/bookings/send-pending-invites', {}, guestToken));
  });

  it('POST /hotels → 403 for hotel_owner / staff / guest', async () => {
    const body = { name: 'Bad Hotel', address: 'Bad St' };
    await expectStatus(403, () => http.post('/hotels', body, ownerToken));
    await expectStatus(403, () => http.post('/hotels', body, staffToken));
    await expectStatus(403, () => http.post('/hotels', body, guestToken));
  });

  it('DELETE /hotels/:id → 403 for hotel_owner / staff / guest', async () => {
    await expectStatus(403, () => http.delete(`/hotels/${testHotelId}`, ownerToken));
    await expectStatus(403, () => http.delete(`/hotels/${testHotelId}`, staffToken));
    await expectStatus(403, () => http.delete(`/hotels/${testHotelId}`, guestToken));
  });

  it('POST /bookings → 404 for guest (no hotel access before role check)', async () => {
    await expectStatus(404, () =>
      http.post(
        '/bookings',
        { startDate: '2026-05-01', endDate: '2026-05-03', guestEmail: EMAILS.guest, hotelId: testHotelId },
        guestToken,
      ),
    );
  });
});
