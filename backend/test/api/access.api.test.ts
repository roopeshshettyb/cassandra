/**
 * API tests for the endpoints api.test.ts and rooms.api.test.ts do not reach, and for
 * ownership: an owner of a different hotel must not read or change this one.
 *
 * Same setup as api.test.ts: talks to the backend running on BACKEND_PORT, against the database
 * in test.env, else dev.env. Everything it creates is tagged and removed in afterAll.
 * What is covered where: test/README.md.
 *
 * Run: npm run test:api
 */
// First: it loads the Nest modules in the order their circular references need.
import { bootstrap, httpClient, call, expectStatus, signIn, day, Session } from './helpers';
import * as nodeHttp from 'http';
import * as nodeHttps from 'https';
import { TestingModule } from '@nestjs/testing';
import { AccountsService } from '../../src/accounts/accounts.service';
import { HotelsService } from '../../src/hotels/hotels.service';
import { HOTEL_BRANDS_REPOSITORY } from '../../src/hotels/hotels.repository';
import { AccountRole } from '../../src/accounts/accounts.model';
import { ConstantsService, HotelMemberStatus } from '../../src/common/constants/constants.service';
import { HotelAccount } from '../../src/hotels/hotel-accounts.model';
import { Hotel } from '../../src/hotels/hotels.model';
import { Booking } from '../../src/bookings/bookings.model';
import { OrganisationsService } from '../../src/organisations/organisations.service';
import { Op } from 'sequelize';

const TAG = `atest_${Date.now()}`;
const email = (who: string) => `${TAG}_${who}@cassandratest.local`;
const ADMIN_ACCOUNT: any = { role: AccountRole.ADMIN };

let moduleRef: TestingModule;
let constants: ConstantsService;
let baseUrl: string;
let http: ReturnType<typeof httpClient>;
let admin: Session, owner: Session, staff: Session, guest: Session, outsider: Session;
const ids = { hotel: 0, otherHotel: 0, booking: 0, request: 0, menuItem: 0, orgA: 0, orgB: 0, brand: 0 };
const hotelAddress = `1 ${TAG} Street`;

beforeAll(async () => {
  const boot = await bootstrap();
  moduleRef = boot.moduleRef;
  constants = boot.constants;
  baseUrl = boot.baseUrl;
  http = httpClient(baseUrl);

  admin = await signIn(moduleRef, baseUrl, email('admin'), AccountRole.ADMIN);
  const orgA = await http.post('/organisations', { name: `Org A ${TAG}` }, admin.token);
  const orgB = await http.post('/organisations', { name: `Org B ${TAG}` }, admin.token);
  ids.orgA = orgA.data.data.id;
  ids.orgB = orgB.data.data.id;

  owner = await signIn(moduleRef, baseUrl, email('owner'), AccountRole.HOTEL_OWNER, { organisationId: ids.orgA });
  staff = await signIn(moduleRef, baseUrl, email('staff'), AccountRole.HOTEL_STAFF, { organisationId: ids.orgA });
  guest = await signIn(moduleRef, baseUrl, email('guest'), AccountRole.GUEST);
  outsider = await signIn(moduleRef, baseUrl, email('outsider'), AccountRole.HOTEL_OWNER, { organisationId: ids.orgB });

  ids.hotel = (await http.post('/hotels', { name: `Access Hotel ${TAG}`, address: hotelAddress, checkInTime: '14:00', checkOutTime: '11:00' }, admin.token)).data.id;
  await http.post(`/hotels/${ids.hotel}/access`, { accountId: owner.id }, admin.token);
  await http.post(`/hotels/${ids.hotel}/access`, { accountId: staff.id }, admin.token);
  ids.otherHotel = (await http.post('/hotels', { name: `Outsider Hotel ${TAG}`, address: '2 Elsewhere' }, outsider.token)).data.id;

  // From yesterday, so the stay has begun whatever the time of day (check-in is 14:00).
  const booking = await http.post('/bookings', { hotelId: ids.hotel, startDate: day(-1), endDate: day(7), guestEmail: guest.email, roomNumber: '101' }, staff.token);
  ids.booking = booking.data.data.id;
  const request = await http.post('/requests', { hotelId: ids.hotel, guestId: guest.id, bookingId: ids.booking, requestType: 'house_keeping', urgency: 'low' }, guest.token);
  ids.request = request.data.data.id;
  ids.menuItem = (await http.post('/restaurant/menu-items', { hotelId: ids.hotel, name: 'Tea', category: 'beverage', price: 2 }, staff.token)).data.data.id;
}, 120000);

afterAll(async () => {
  const hotels = moduleRef.get(HotelsService);
  for (const id of [ids.hotel, ids.otherHotel]) await hotels.deleteHotel(id, ADMIN_ACCOUNT, true).catch(() => {});
  // The delete endpoints only soft-delete, so what the delete tests removed is still there as rows.
  const tagged = { name: { [Op.like]: `%${TAG}%` } };
  await Hotel.destroy({ where: tagged, force: true });
  await moduleRef.get<any>(HOTEL_BRANDS_REPOSITORY).destroy({ where: tagged, force: true });
  await moduleRef.get(AccountsService).delete({ email: ['owner', 'staff', 'guest', 'outsider', 'otp', 'admin', 'member', 'extra', 'created'].map(email) }, true);
  await moduleRef.get(OrganisationsService).hardDeleteByNamePrefix(TAG);
  await moduleRef.close();
  nodeHttp.globalAgent.destroy();
  nodeHttps.globalAgent.destroy();
}, 180000);

describe('App', () => {
  it('GET / and GET /health answer without a session', async () => {
    await expectStatus(200, () => http.get('/'));
    const res = await expectStatus(200, () => http.get('/health'));
    expect(res.data.status).toBe('ok');
  });
});

describe('Sign in', () => {
  it('POST /oauth/email/send-otp → sends a code, creating the account on first use', async () => {
    const res = await expectStatus(201, () => http.post('/oauth/email/send-otp', { email: email('otp') }));
    expect(res.data).toEqual({ success: true });
    const account = await moduleRef.get(AccountsService).findByUuid(`email:${email('otp')}`);
    expect(account.otp).toMatch(/^\d+$/);
    expect(new Date(account.otpExpiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('POST /oauth/callback → a session for the right OTP', async () => {
    const { otp } = await moduleRef.get(AccountsService).findByUuid(`email:${email('otp')}`);
    const res = await expectStatus(201, () => http.post('/oauth/callback', { authType: 'email', email: email('otp'), otp }));
    expect(res.data).toMatchObject({ token: expect.any(String), account: { email: email('otp') } });
  });
});

describe('Dashboard', () => {
  it('GET /dashboard (staff) → stats for their hotel', async () => {
    const res = await expectStatus(200, () => http.get('/dashboard', staff.token));
    expect(res.data.success).toBe(true);
    expect(res.data.data.stats.totalBookings).toBeGreaterThanOrEqual(1);
    expect(res.data.data.propertyRows.map((r: any) => r.id)).toContain(ids.hotel);
  });

  it('GET /dashboard (outsider) → nothing from this hotel', async () => {
    const res = await expectStatus(200, () => http.get('/dashboard', outsider.token));
    expect(res.data.data.propertyRows.map((r: any) => r.id)).not.toContain(ids.hotel);
  });

  it('GET /dashboard → 401 without a token', async () => {
    await expectStatus(401, () => http.get('/dashboard'));
  });
});

describe('Accounts', () => {
  it('GET /accounts/:id → always the caller, whatever id is asked for', async () => {
    const res = await expectStatus(200, () => http.get(`/accounts/${owner.id}`, guest.token));
    expect(res.data.id).toBe(guest.id);
  });

  it('POST /accounts → creates an account; GET /accounts/count → counts it by filter', async () => {
    const created = await expectStatus(201, () => http.post('/accounts', { uuid: `email:${email('created')}`, email: email('created') }));
    expect(created.data.email).toBe(email('created'));
    const filter = encodeURIComponent(JSON.stringify({ where: { email: email('created') } }));
    const res = await expectStatus(200, () => http.get(`/accounts/count?filter=${filter}`));
    expect(res.data).toEqual({ count: 1 });
  });

  it('POST /accounts → 400 for a role that does not exist', async () => {
    await expectStatus(400, () => http.post('/accounts', { email: email('bad'), role: 'superuser' }));
  });
});

describe('Bookings', () => {
  it('GET /bookings/active (guest) → their current stay', async () => {
    const res = await expectStatus(200, () => http.get('/bookings/active', guest.token));
    expect(res.data.data.id).toBe(ids.booking);
  });

  it('GET /bookings/active (staff) → 403', async () => {
    await expectStatus(403, () => http.get('/bookings/active', staff.token));
  });

  it('POST /bookings/reservation-document-upload-url → a presigned url for a temp key', async () => {
    const res = await expectStatus(201, () => http.post('/bookings/reservation-document-upload-url', { contentType: 'application/pdf' }, staff.token));
    expect(res.data.data.key).toMatch(new RegExp(`^${constants.private.AWS_S3_KEY_PREFIX}temp/.+\\.pdf$`));
    expect(res.data.data.uploadUrl).toMatch(/^https:\/\//);
  });

  it.each(['extract-from-reservation-document', 'from-reservation-document'])('POST /bookings/%s → 400 for a key outside temp/', async (route) => {
    const res = await expectStatus(400, () => http.post(`/bookings/${route}`, { key: 'bookings/1/x.pdf' }, staff.token));
    expect(res.data.message).toBe('Invalid reservation document key');
  });

  it('GET /bookings/:id/reservation-document-url → 404 without a document, and for an outsider', async () => {
    await expectStatus(404, () => http.get(`/bookings/${ids.booking}/reservation-document-url`, staff.token));
    await expectStatus(404, () => http.get(`/bookings/${ids.booking}/reservation-document-url`, outsider.token));
  });

  it('GET /bookings/:id/reservation-document-url → a signed url once the booking has a document', async () => {
    const key = `${constants.private.AWS_S3_KEY_PREFIX}bookings/${ids.booking}/doc.pdf`;
    await Booking.update({ reservationDocumentS3Key: key }, { where: { id: ids.booking } });
    const res = await expectStatus(200, () => http.get(`/bookings/${ids.booking}/reservation-document-url`, staff.token));
    expect(res.data.data.url).toContain(`bookings/${ids.booking}/doc.pdf`);
  });

  it('GET/PATCH/DELETE /bookings/:id → 404 for an outsider, booking untouched', async () => {
    await expectStatus(404, () => http.get(`/bookings/${ids.booking}`, outsider.token));
    await expectStatus(404, () => http.patch(`/bookings/${ids.booking}`, { roomNumber: '999' }, outsider.token));
    await expectStatus(404, () => http.delete(`/bookings/${ids.booking}`, outsider.token));
    const res = await expectStatus(200, () => http.get(`/bookings/${ids.booking}`, staff.token));
    expect(res.data.data.roomNumber).toBe('101');
  });

  it('GET /bookings/:id → 400 for a non-numeric id', async () => {
    await expectStatus(400, () => http.get('/bookings/abc', staff.token));
  });
});

describe('Requests', () => {
  it('GET /requests/:id → the guest sees their own, an outsider gets 404', async () => {
    await expectStatus(200, () => http.get(`/requests/${ids.request}`, guest.token));
    await expectStatus(404, () => http.get(`/requests/${ids.request}`, outsider.token));
  });

  it('PATCH /requests/:id and append-message → 404 for an outsider', async () => {
    await expectStatus(404, () => http.patch(`/requests/${ids.request}`, { status: 'completed' }, outsider.token));
    await expectStatus(404, () => http.post(`/requests/${ids.request}/append-message`, { message: 'x' }, outsider.token));
  });

  it('POST /requests/:id/append-message (guest) → 404 for a request that does not exist', async () => {
    await expectStatus(404, () => http.post('/requests/999999999/append-message', { message: 'x' }, guest.token));
  });

  it('POST /requests → 400 when the booking does not match the hotel', async () => {
    const res = await expectStatus(400, () =>
      http.post('/requests', { hotelId: ids.otherHotel, guestId: guest.id, bookingId: ids.booking, requestType: 'house_keeping', urgency: 'low' }, guest.token),
    );
    expect(res.data.message).toBe('Booking does not match hotelId and guestId');
  });
});

describe('Notifications', () => {
  it('GET and PATCH /notifications/preferences → read, change one, keep the other', async () => {
    await expectStatus(200, () => http.patch('/notifications/preferences', { emailEnabled: false }, guest.token));
    const res = await expectStatus(200, () => http.get('/notifications/preferences', guest.token));
    expect(res.data.data).toEqual({ pushEnabled: true, emailEnabled: false });
  });

  it('POST /notifications/register-device → 201', async () => {
    await expectStatus(201, () => http.post('/notifications/register-device', { token: `${TAG}-device` }, guest.token));
  });

  it('PATCH /notifications/:id/read → touches only the caller own notifications', async () => {
    const res = await expectStatus(200, () => http.patch('/notifications/999999999/read', {}, guest.token));
    expect(res.data[0]).toBe(0);
  });
});

describe('Organisations', () => {
  it('GET /organisations → an admin sees both, an owner only their own', async () => {
    const all = await expectStatus(200, () => http.get(`/organisations?keywords=${TAG}`, admin.token));
    expect(all.data.data.map((o: any) => o.id)).toEqual(expect.arrayContaining([ids.orgA, ids.orgB]));
    const mine = await expectStatus(200, () => http.get('/organisations', owner.token));
    expect(mine.data.data.map((o: any) => o.id)).toEqual([ids.orgA]);
    expect(mine.data.data[0].memberCount).toBe(2);
  });

  it('PATCH /organisations/:id (admin) → renames, and refuses a name already taken', async () => {
    const res = await expectStatus(200, () => http.patch(`/organisations/${ids.orgB}`, { name: `Org B renamed ${TAG}` }, admin.token));
    expect(res.data).toMatchObject({ message: constants.private.ORGANISATIONS.MSG_UPDATED, data: { name: `Org B renamed ${TAG}` } });
    const taken = await expectStatus(400, () => http.patch(`/organisations/${ids.orgB}`, { name: `Org A ${TAG}` }, admin.token));
    expect(taken.data.message).toBe(constants.private.ORGANISATIONS.ERROR_NAME_TAKEN);
  });

  it('GET /organisations/:id → own 200, another 404', async () => {
    await expectStatus(200, () => http.get(`/organisations/${ids.orgA}`, owner.token));
    const res = await expectStatus(404, () => http.get(`/organisations/${ids.orgB}`, owner.token));
    expect(res.data.message).toBe(constants.private.ORGANISATIONS.ERROR_NOT_FOUND);
  });

  it('PATCH /organisation-users/:id (admin) → 400 for a guest account', async () => {
    const res = await expectStatus(400, () => http.patch(`/organisation-users/${guest.id}`, { name: 'x' }, admin.token));
    expect(res.data.message).toBe(constants.private.ORGANISATIONS.USERS.ERROR_GUEST_NOT_MANAGEABLE);
  });

  it('PATCH /organisation-users/:id (admin) → updates the user', async () => {
    const res = await expectStatus(200, () => http.patch(`/organisation-users/${staff.id}`, { name: `Renamed ${TAG}` }, admin.token));
    expect(res.data.data.name).toBe(`Renamed ${TAG}`);
  });
});

describe('Hotels', () => {
  it('GET /hotels/:id → 404 for an outsider; PATCH → 403', async () => {
    await expectStatus(404, () => http.get(`/hotels/${ids.hotel}`, outsider.token));
    await expectStatus(403, () => http.patch(`/hotels/${ids.hotel}`, { name: 'Taken over' }, outsider.token));
  });

  it('members → 403 for an outsider, and for staff', async () => {
    for (const who of [outsider, staff]) {
      await expectStatus(403, () => http.get(`/hotels/${ids.hotel}/staff`, who.token));
      await expectStatus(403, () => http.post(`/hotels/${ids.hotel}/staff`, { email: email('x'), name: 'X', role: 'hotel_staff' }, who.token));
    }
  });

  it('404 for a hotel, member or account that does not exist', async () => {
    await expectStatus(404, () => http.delete('/hotels/999999999', admin.token));
    await expectStatus(404, () => http.get('/hotels/999999999/staff', admin.token));
    await expectStatus(404, () => http.patch(`/hotels/${ids.hotel}/staff/999999999/status`, { status: 'active' }, owner.token));
    await expectStatus(404, () => http.post('/hotels/999999999/access', { accountId: staff.id }, admin.token));
    await expectStatus(404, () => http.post(`/hotels/${ids.hotel}/access`, { accountId: 999999999 }, admin.token));
  });

  it('PATCH /hotels/:id/staff/:accountId/status → 400 for pending', async () => {
    const res = await expectStatus(400, () => http.patch(`/hotels/${ids.hotel}/staff/${staff.id}/status`, { status: 'pending' }, owner.token));
    expect(res.data.message).toBe('Only active and disabled statuses can be set manually');
  });

  it('POST /hotels/:id/staff/import → 400 for an empty file', async () => {
    const res = await expectStatus(400, () => http.post(`/hotels/${ids.hotel}/staff/import`, { csvContent: 'email,name,role\n' }, owner.token));
    expect(res.data.message).toBe('No rows found in csv');
  });

  it('DELETE /hotels/:id/staff/:accountId → owner disables a member, staff cannot', async () => {
    const member: any = { email: email('member'), name: 'M', role: AccountRole.HOTEL_STAFF };
    const victim = await moduleRef.get(HotelsService).addStaffByEmail(ids.hotel, member, ADMIN_ACCOUNT);
    await expectStatus(403, () => http.delete(`/hotels/${ids.hotel}/staff/${victim.id}`, staff.token));
    await expectStatus(200, () => http.delete(`/hotels/${ids.hotel}/staff/${victim.id}`, owner.token));
    const membership = await HotelAccount.findOne({ where: { hotelId: ids.hotel, accountId: victim.id } });
    expect(membership.status).toBe(HotelMemberStatus.DISABLED);
  });

  it('POST and DELETE /hotels/:id/access → admin grants and revokes; an owner cannot revoke', async () => {
    const extra = await signIn(moduleRef, baseUrl, email('extra'), AccountRole.HOTEL_STAFF, { organisationId: ids.orgA });
    await expectStatus(201, () => http.post(`/hotels/${ids.hotel}/access`, { accountId: extra.id }, admin.token));
    await expectStatus(200, () => http.get(`/hotels/${ids.hotel}`, extra.token));
    await expectStatus(403, () => http.delete(`/hotels/${ids.hotel}/access/${extra.id}`, owner.token));
    await expectStatus(200, () => http.delete(`/hotels/${ids.hotel}/access/${extra.id}`, admin.token));
    await expectStatus(404, () => http.get(`/hotels/${ids.hotel}`, extra.token));
  });

  describe('media', () => {
    const file = { fileName: 'a.png', fileSize: 1000, contentType: 'image/png' };
    const imageA = `https://example.com/${TAG}/a.png`;
    const imageB = `https://example.com/${TAG}/b.png`;

    it.each(['logo', 'images', 'notification-tone'])('POST /hotels/:id/%s/presigned-url → upload url for a member, 404 for an outsider', async (kind) => {
      const body = kind === 'notification-tone' ? { ...file, fileName: 'a.mp3', contentType: 'audio/mpeg' } : file;
      const res = await expectStatus(201, () => http.post(`/hotels/${ids.hotel}/${kind}/presigned-url`, body, staff.token));
      expect(res.data.success).toBe(true);
      await expectStatus(404, () => http.post(`/hotels/${ids.hotel}/${kind}/presigned-url`, body, outsider.token));
    });

    it('presigned-url → 400 for the wrong file type', async () => {
      const res = await expectStatus(400, () => http.post(`/hotels/${ids.hotel}/images/presigned-url`, { ...file, contentType: 'application/pdf' }, staff.token));
      expect(res.data.message).toBe('Only image files are allowed');
    });

    it('PATCH /hotels/:id/logo → stores the logo', async () => {
      const res = await expectStatus(200, () => http.patch(`/hotels/${ids.hotel}/logo`, { s3Url: imageA }, staff.token));
      expect(res.data.data.logoUrl).toBe(imageA);
    });

    it('images → add, reorder, refuse a bad order, remove', async () => {
      await expectStatus(201, () => http.post(`/hotels/${ids.hotel}/images`, { s3Url: imageA }, staff.token));
      await expectStatus(201, () => http.post(`/hotels/${ids.hotel}/images`, { s3Url: imageB }, staff.token));
      const reordered = await expectStatus(200, () => http.patch(`/hotels/${ids.hotel}/images/reorder`, { images: [imageB, imageA] }, staff.token));
      expect(reordered.data.data.images).toEqual([imageB, imageA]);
      const bad = await expectStatus(400, () => http.patch(`/hotels/${ids.hotel}/images/reorder`, { images: [imageA] }, staff.token));
      expect(bad.data.message).toBe('Invalid image list');
      const removed = await expectStatus(200, () => http.delete(`/hotels/${ids.hotel}/images`, staff.token, { s3Url: imageB }));
      expect(removed.data.data.images).toEqual([imageA]);
    });

    it('images and logo → 404 for an outsider', async () => {
      await expectStatus(404, () => http.post(`/hotels/${ids.hotel}/images`, { s3Url: imageA }, outsider.token));
      await expectStatus(404, () => http.patch(`/hotels/${ids.hotel}/logo`, { s3Url: imageA }, outsider.token));
      await expectStatus(404, () => http.delete(`/hotels/${ids.hotel}/images`, outsider.token, { s3Url: imageA }));
    });

    it('notification tone → built-in by default, custom once set', async () => {
      const builtIn = await expectStatus(200, () => http.get(`/hotels/${ids.hotel}/notification-tone/signed-url`, staff.token));
      expect(builtIn.data.isBuiltIn).toBe(true);
      const set = await expectStatus(200, () => http.patch(`/hotels/${ids.hotel}/notification-tone`, { s3Url: 'alert_sound' }, staff.token));
      expect(set.data.data.notificationTone).toBe('custom');
      const named = await expectStatus(200, () => http.get(`/hotels/${ids.hotel}/notification-tone/signed-url`, staff.token));
      expect(named.data.builtInPath).toBe('/assets/tones/alert_sound.mp3');
      await expectStatus(404, () => http.get(`/hotels/${ids.hotel}/notification-tone/signed-url`, outsider.token));
    });
  });

  describe('brands', () => {
    beforeAll(async () => {
      const brand = await moduleRef.get<any>(HOTEL_BRANDS_REPOSITORY).create({ name: `Brand ${TAG}` });
      ids.brand = brand.id;
      await http.patch(`/hotels/${ids.hotel}`, { hotelBrandId: ids.brand }, admin.token);
    });

    it('GET /hotels/brands/:brandId → admin only, 404 when missing', async () => {
      const res = await expectStatus(200, () => http.get(`/hotels/brands/${ids.brand}`, admin.token));
      expect(res.data.data.hotels.map((h: any) => h.id)).toContain(ids.hotel);
      await expectStatus(403, () => http.get(`/hotels/brands/${ids.brand}`, owner.token));
      await expectStatus(404, () => http.get('/hotels/brands/999999999', admin.token));
    });

    it('PATCH /hotels/brands/:brandId → an owner of a brand hotel may, propagating to its hotels; an outsider may not', async () => {
      await expectStatus(200, () => http.patch(`/hotels/brands/${ids.brand}`, { poolHours: '06:00-20:00', propagate: true }, owner.token));
      const hotel = await expectStatus(200, () => http.get(`/hotels/${ids.hotel}`, owner.token));
      expect(hotel.data.poolHours).toBe('06:00-20:00');
      await expectStatus(403, () => http.patch(`/hotels/brands/${ids.brand}`, { poolHours: 'x' }, outsider.token));
    });

    it('PATCH /hotels/brands/:brandId → 404 when missing', async () => {
      await expectStatus(404, () => http.patch('/hotels/brands/999999999', { poolHours: 'x' }, admin.token));
    });

    it('DELETE /hotels/brands/:brandId → admin only, 404 when missing', async () => {
      await expectStatus(403, () => http.delete(`/hotels/brands/${ids.brand}`, owner.token));
      await expectStatus(404, () => http.delete('/hotels/brands/999999999', admin.token));
    });

    it('DELETE /hotels/brands/:brandId (admin) → removes the brand and its hotels', async () => {
      const brand = await moduleRef.get<any>(HOTEL_BRANDS_REPOSITORY).create({ name: `Doomed Brand ${TAG}` });
      const hotelId = (await http.post('/hotels', { name: `Doomed Brand Hotel ${TAG}`, address: `3 ${TAG} Street` }, admin.token)).data.id;
      await http.patch(`/hotels/${hotelId}`, { hotelBrandId: brand.id }, admin.token);
      await expectStatus(200, () => http.delete(`/hotels/brands/${brand.id}`, admin.token));
      await expectStatus(404, () => http.get(`/hotels/brands/${brand.id}`, admin.token));
      await expectStatus(404, () => http.get(`/hotels/${hotelId}`, admin.token));
    });
  });

  it('DELETE /hotels/:id (admin) → removes the hotel', async () => {
    const hotelId = (await http.post('/hotels', { name: `Doomed Hotel ${TAG}`, address: `4 ${TAG} Street` }, admin.token)).data.id;
    const res = await expectStatus(200, () => http.delete(`/hotels/${hotelId}`, admin.token));
    expect(res.data.success).toBe(true);
    await expectStatus(404, () => http.get(`/hotels/${hotelId}`, admin.token));
  });

  it('POST /hotels/onboarding/finalize (admin) → creates the hotel at a new address', async () => {
    const res = await expectStatus(201, () => http.post('/hotels/onboarding/finalize', { name: `Onboarded ${TAG}`, address: `5 ${TAG} Street`, checkInTime: '13:00' }, admin.token));
    expect(res.data).toMatchObject({ success: true, data: { name: `Onboarded ${TAG}`, checkInTime: '13:00' } });
    await http.delete(`/hotels/${res.data.data.id}`, admin.token);
  });

  // Admins and owners reach Google Maps and OpenAI here, so only the refusals run against the API.
  it('GET /hotels/onboarding/search, analyze and POST extract → 403 for staff and guests', async () => {
    for (const who of [staff, guest]) {
      await expectStatus(403, () => http.get('/hotels/onboarding/search?query=taj', who.token));
      await expectStatus(403, () => http.get('/hotels/onboarding/analyze/place-1', who.token));
      await expectStatus(403, () => http.post('/hotels/onboarding/extract', { placeId: 'place-1' }, who.token));
    }
  });
});

describe('Restaurant', () => {
  it('POST /restaurant/menu-ocr/presigned-url → upload url for staff, 404 for an outsider', async () => {
    const body = { hotelId: ids.hotel, fileName: 'menu.png', fileSize: 1000, contentType: 'image/png' };
    const res = await expectStatus(201, () => http.post('/restaurant/menu-ocr/presigned-url', body, staff.token));
    expect(res.data.data.s3Key).toContain('menu-ocr-temp/');
    await expectStatus(404, () => http.post('/restaurant/menu-ocr/presigned-url', body, outsider.token));
  });

  it('POST /restaurant/menu-ocr/extract → 400 for an image outside the temp folder', async () => {
    const res = await expectStatus(400, () => http.post('/restaurant/menu-ocr/extract', { hotelId: ids.hotel, imageUrls: ['https://evil.example/a/b/c.png'] }, staff.token));
    expect(res.data.message).toBe('Invalid image URL');
  });

  it('POST /restaurant/menu-items/bulk → creates all, or none when one is for another hotel', async () => {
    const items = [
      { hotelId: ids.hotel, name: 'Coffee', category: 'beverage' },
      { hotelId: ids.hotel, name: 'Toast', category: 'breakfast' },
    ];
    const res = await expectStatus(201, () => http.post('/restaurant/menu-items/bulk', { hotelId: ids.hotel, items }, staff.token));
    expect(res.data.data).toHaveLength(2);
    const bad = await expectStatus(400, () => http.post('/restaurant/menu-items/bulk', { hotelId: ids.hotel, items: [{ hotelId: ids.otherHotel, name: 'X', category: 'beverage' }] }, staff.token));
    expect(bad.data.message).toBe('Item hotelId must match bulk hotelId');
  });

  it('GET /restaurant/menu-items/:id → 404 for an item that does not exist', async () => {
    await expectStatus(404, () => http.get('/restaurant/menu-items/999999999', staff.token));
  });

  it('PATCH/DELETE /restaurant/menu-items/:id → 404 for an outsider', async () => {
    await expectStatus(404, () => http.patch(`/restaurant/menu-items/${ids.menuItem}`, { price: 1 }, outsider.token));
    await expectStatus(404, () => http.delete(`/restaurant/menu-items/${ids.menuItem}`, outsider.token));
  });
});

describe('Rooms', () => {
  it('PATCH /rooms/types/:id and /rooms/:id → 404 for ones that do not exist', async () => {
    await expectStatus(404, () => http.patch('/rooms/types/999999999', { name: 'x' }, staff.token));
    await expectStatus(404, () => http.patch('/rooms/999999999', { roomNumber: 'x' }, staff.token));
  });
});

describe('Integrations', () => {
  it('GET /hotels/:hotelId/integrations → 403 for an outsider', async () => {
    await expectStatus(403, () => http.get(`/hotels/${ids.hotel}/integrations`, outsider.token));
  });

  it('DELETE /hotels/:hotelId/integrations/token → 404 when the hotel has no token', async () => {
    await expectStatus(404, () => http.delete(`/hotels/${ids.otherHotel}/integrations/token`, outsider.token));
  });

  it('POST /integrations/providers/:provider/webhooks → 404 for an unknown provider, 400 for a malformed body', async () => {
    const token = (await http.post(`/hotels/${ids.hotel}/integrations/token`, {}, owner.token)).data.data.token;
    const unknown = await expectStatus(404, () => http.post('/integrations/providers/mews/webhooks', {}, token));
    expect(unknown.data.message).toBe(constants.private.INTEGRATIONS.ERROR_UNKNOWN_PROVIDER);
    const malformed = await expectStatus(400, () => http.post('/integrations/providers/canonical/webhooks', { type: 'nope' }, token));
    expect(malformed.data.message).toBe(constants.private.INTEGRATIONS.ERROR_MALFORMED_CANONICAL_BODY);
  });
});

describe('Costs', () => {
  it('GET /costs/aggregate (guest) → nothing', async () => {
    const res = await expectStatus(200, () => http.get('/costs/aggregate', guest.token));
    expect(res.data.data).toEqual([]);
  });
});

// Access gaps found while writing these tests (test/README.md, known problems). Each passes
// while the gap is open and starts failing once it is fixed — then drop `.failing`.
describe('Known access gaps', () => {
  // JSON.parse throws a plain Error on the query, so a malformed filter answers 500.
  test.failing('GET /accounts/count → 400 for a malformed filter', async () => {
    await expectStatus(400, () => http.get('/accounts/count?filter=not-json'));
  });

  // The body skips ValidationPipe, so RegisterDeviceDto's @IsNotEmpty never runs.
  test.failing('POST /notifications/register-device → 400 without a token', async () => {
    await expectStatus(400, () => http.post('/notifications/register-device', {}, guest.token));
  });

  test.failing('GET /costs/by-hotel/:hotelId → refused to an owner of another hotel', async () => {
    const res = await call(() => http.get(`/costs/by-hotel/${ids.hotel}`, outsider.token));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test.failing('GET /costs/by-booking/:bookingId → refused to an owner of another hotel', async () => {
    const res = await call(() => http.get(`/costs/by-booking/${ids.booking}`, outsider.token));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  // Sign-in failures are plain Errors, so they answer 500 (branch fix/oauth-error-codes).
  test.failing.each([
    ['POST /oauth/callback, wrong OTP', '/oauth/callback', () => ({ authType: 'email', email: guest.email, otp: '000000' })],
    ['POST /oauth/callback, no OTP', '/oauth/callback', () => ({ authType: 'email', email: guest.email })],
    ['POST /oauth/callback, no authType', '/oauth/callback', () => ({})],
    ['POST /oauth/callback, unknown authType', '/oauth/callback', () => ({ authType: 'nope' })],
    ['POST /oauth/email/send-otp, no email', '/oauth/email/send-otp', () => ({})],
  ])('%s → a 4xx, not 500', async (_name, url, body) => {
    const res = await call(() => http.post(url, body()));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test.failing('POST /hotels/onboarding/finalize → refused to staff overwriting the hotel at an address', async () => {
    const res = await call(() => http.post('/hotels/onboarding/finalize', { name: `Access Hotel ${TAG}`, address: hotelAddress, wifiPassword: 'changed-by-staff' }, staff.token));
    expect(res.status).toBe(403);
  });
});
