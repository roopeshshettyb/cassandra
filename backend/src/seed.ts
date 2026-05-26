import * as dotenv from 'dotenv';
import * as path from 'path';
import { Sequelize } from 'sequelize-typescript';
import { Account } from './accounts/accounts.model';
import { AccountRole, HotelMemberStatus } from './common/constants/constants.service';
import { Hotel } from './hotels/hotels.model';
import { HotelBrand } from './hotels/brands.model';
import { HotelAccount } from './hotels/hotel-accounts.model';
import { Booking } from './bookings/bookings.model';
import { Request, RequestType, RequestUrgency, RequestStatus } from './requests/requests.model';
import { Chat } from './chat/chat.model';

const nodeEnv = process.env.NODE_ENV;
const envFile = nodeEnv === 'prod' ? 'prod.env' : 'dev.env';
dotenv.config({ path: path.resolve(__dirname, `../${envFile}`) });

async function restoreIfSoftDeleted(instance: any) {
  if (!instance) {
    return;
  }
  if (instance.getDataValue('deletedAt')) {
    await instance.restore();
  }
}

async function seed() {
  const sequelize = new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    logging: false,
    models: [Account, Hotel, HotelBrand, HotelAccount, Booking, Request, Chat],
    define: { underscored: true, timestamps: true, paranoid: true },
    dialectOptions: (process.env.DB_SSL === 'true' || process.env.DB_SSL === '1')
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : undefined,
  });

  await sequelize.authenticate();
  await sequelize.sync();

  // ── Accounts ────────────────────────────────────────────────────────────────
  const accountData = [
    { uuid: 'seed-admin-1',  email: 'admin@seed.com',  name: 'Seed Admin',      role: AccountRole.ADMIN,       oauthMeta: {} },
    { uuid: 'seed-owner-1',  email: 'owner1@seed.com', name: 'Hotel Owner One', role: AccountRole.HOTEL_OWNER, oauthMeta: {} },
    { uuid: 'seed-staff-1',  email: 'staff1@seed.com', name: 'Staff One',       role: AccountRole.HOTEL_STAFF, oauthMeta: {} },
    { uuid: 'seed-guest-1',  email: 'guest1@seed.com', name: 'Guest One',       role: AccountRole.GUEST,       oauthMeta: {} },
    { uuid: 'seed-guest-2',  email: 'guest2@seed.com', name: 'Guest Two',       role: AccountRole.GUEST,       oauthMeta: {} },
  ];
  const accounts: Account[] = [];
  for (const row of accountData) {
    const [acc] = await Account.findOrCreate({ where: { email: row.email }, defaults: row as any, paranoid: false });
    await restoreIfSoftDeleted(acc);
    accounts.push(acc);
  }

  // ── Brands ──────────────────────────────────────────────────────────────────
  const brandData = [
    {
      name: 'Radisson',
      checkInTime: '15:00', checkOutTime: '12:00',
      themeConfig: { primaryColor: '#D4141C', secondaryColor: '#A50E16' },
    },
    {
      name: 'Taj Hotels',
      checkInTime: '14:00', checkOutTime: '12:00',
      themeConfig: { primaryColor: '#C4922A', secondaryColor: '#9B7310' },
    },
    {
      name: 'ITC Hotels',
      checkInTime: '14:00', checkOutTime: '12:00',
      themeConfig: { primaryColor: '#2D6A4F', secondaryColor: '#1B4332' },
    },
    {
      name: 'Marriott',
      checkInTime: '16:00', checkOutTime: '12:00',
      themeConfig: { primaryColor: '#B5001A', secondaryColor: '#8A0013' },
    },
    {
      name: 'Four Seasons',
      checkInTime: '15:00', checkOutTime: '12:00',
      themeConfig: { primaryColor: '#003D2B', secondaryColor: '#B8932A' },
    },
    {
      name: 'Hyatt',
      checkInTime: '15:00', checkOutTime: '12:00',
      themeConfig: { primaryColor: '#6D3F2F', secondaryColor: '#4A2920' },
    },
    {
      name: 'Jumeirah',
      checkInTime: '15:00', checkOutTime: '12:00',
      themeConfig: { primaryColor: '#006169', secondaryColor: '#004A50' },
    },
  ];
  const brands: Record<string, HotelBrand> = {};
  for (const row of brandData) {
    const [b] = await HotelBrand.findOrCreate({ where: { name: row.name }, defaults: row as any, paranoid: false });
    await restoreIfSoftDeleted(b);
    brands[row.name] = b;
  }

  // ── Hotels ──────────────────────────────────────────────────────────────────
  const hotelData = [
    {
      name: 'Radisson Blu Plaza Delhi',
      address: 'National Highway 8, Mahipalpur, New Delhi, Delhi 110037',
      checkInTime: '15:00', checkOutTime: '12:00',
      hotelBrandId: brands['Radisson'].id,
      themeConfig: brands['Radisson'].themeConfig,
    },
    {
      name: 'The Taj Mahal Palace',
      address: 'Apollo Bandar, Colaba, Mumbai, Maharashtra 400001',
      checkInTime: '14:00', checkOutTime: '12:00',
      hotelBrandId: brands['Taj Hotels'].id,
      themeConfig: brands['Taj Hotels'].themeConfig,
    },
    {
      name: 'ITC Maurya',
      address: 'Sardar Patel Marg, Diplomatic Enclave, Chanakyapuri, New Delhi 110021',
      checkInTime: '14:00', checkOutTime: '12:00',
      hotelBrandId: brands['ITC Hotels'].id,
      themeConfig: brands['ITC Hotels'].themeConfig,
    },
    {
      name: 'Taj Cidade De Goa Horizon',
      address: 'Vainguinim Plateau, Panaji, Goa 403004',
      checkInTime: '14:00', checkOutTime: '12:00',
      hotelBrandId: brands['Taj Hotels'].id,
      themeConfig: brands['Taj Hotels'].themeConfig,
    },
    {
      name: 'JW Marriott Sahar',
      address: 'Sahar, Andheri East, Mumbai, Maharashtra 400099',
      checkInTime: '16:00', checkOutTime: '12:00',
      hotelBrandId: brands['Marriott'].id,
      themeConfig: brands['Marriott'].themeConfig,
    },
    {
      name: 'St. Regis Mumbai',
      address: '462, Senapati Bapat Marg, Lower Parel, Mumbai 400013',
      checkInTime: '15:00', checkOutTime: '12:00',
      hotelBrandId: brands['Marriott'].id,
      themeConfig: brands['Marriott'].themeConfig,
    },
    {
      name: 'Four Seasons Mumbai',
      address: '1/136, Dr. E Moses Road, Worli, Mumbai 400018',
      checkInTime: '15:00', checkOutTime: '12:00',
      hotelBrandId: brands['Four Seasons'].id,
      themeConfig: brands['Four Seasons'].themeConfig,
    },
    {
      name: 'Grand Hyatt Mumbai',
      address: 'Santacruz-Chembur Link Road, Mumbai 400055',
      checkInTime: '15:00', checkOutTime: '12:00',
      hotelBrandId: brands['Hyatt'].id,
      themeConfig: brands['Hyatt'].themeConfig,
    },
    {
      name: 'Burj Al Arab Jumeirah',
      address: 'Jumeirah Beach Road, Dubai, UAE',
      checkInTime: '15:00', checkOutTime: '12:00',
      hotelBrandId: brands['Jumeirah'].id,
      themeConfig: brands['Jumeirah'].themeConfig,
    },
    {
      name: 'The Lodhi',
      address: 'Lodhi Road, New Delhi 110003',
      checkInTime: '14:00', checkOutTime: '12:00',
    },
    {
      name: 'The Twin Towers Hotel New Kufri',
      address: 'Kufri, Shimla, Himachal Pradesh 171012',
      checkInTime: '12:00', checkOutTime: '10:00',
    },
    {
      name: 'Hotel de Paris Monte-Carlo',
      address: 'Place du Casino, 98000 Monaco',
      checkInTime: '15:00', checkOutTime: '12:00',
    },
    {
      name: "Badrutt's Palace Hotel St. Moritz",
      address: 'Via Serlas 27, 7500 St. Moritz, Switzerland',
      checkInTime: '15:00', checkOutTime: '12:00',
    },
  ];
  const hotels: Hotel[] = [];
  for (const row of hotelData) {
    const [h] = await Hotel.findOrCreate({ where: { name: row.name }, defaults: row as any, paranoid: false });
    await restoreIfSoftDeleted(h);
    if (row.hotelBrandId && !h.hotelBrandId) {
      await Hotel.update({ hotelBrandId: row.hotelBrandId, themeConfig: row.themeConfig }, { where: { id: h.id } });
    }
    hotels.push(h);
  }

  // ── Hotel Accounts ───────────────────────────────────────────────────────────
  const hotelAccountLinks = [
    { hotelIdx: 0, accountIdx: 1, role: AccountRole.HOTEL_OWNER, status: HotelMemberStatus.ACTIVE },
    { hotelIdx: 0, accountIdx: 2, role: AccountRole.HOTEL_STAFF, status: HotelMemberStatus.ACTIVE },
    { hotelIdx: 1, accountIdx: 1, role: AccountRole.HOTEL_OWNER, status: HotelMemberStatus.ACTIVE },
    { hotelIdx: 2, accountIdx: 1, role: AccountRole.HOTEL_OWNER, status: HotelMemberStatus.ACTIVE },
    { hotelIdx: 2, accountIdx: 2, role: AccountRole.HOTEL_STAFF, status: HotelMemberStatus.PENDING },
  ];
  for (const link of hotelAccountLinks) {
    const [hotelAccount] = await HotelAccount.findOrCreate({
      where: { hotelId: hotels[link.hotelIdx].id, accountId: accounts[link.accountIdx].id },
      defaults: {
        hotelId: hotels[link.hotelIdx].id,
        accountId: accounts[link.accountIdx].id,
        role: link.role,
        status: link.status,
      },
      paranoid: false,
    });
    await restoreIfSoftDeleted(hotelAccount);
    if (hotelAccount.role !== link.role || hotelAccount.status !== link.status) {
      hotelAccount.role = link.role;
      hotelAccount.status = link.status;
      await hotelAccount.save();
    }
  }

  // ── Bookings ─────────────────────────────────────────────────────────────────
  const now = new Date();
  const d = (offsetDays: number, h = 15, m = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays, h, m, 0);

  const bookingData = [
    { guestId: accounts[3].id, hotelId: hotels[0].id, startTime: d(7), endTime: d(9, 11), roomNumber: '301' },
    { guestId: accounts[3].id, hotelId: hotels[1].id, startTime: d(14), endTime: d(16, 10), roomNumber: '512' },
    { guestId: accounts[4].id, hotelId: hotels[0].id, startTime: d(14), endTime: d(16, 10), roomNumber: '204' },
    { guestId: accounts[4].id, hotelId: hotels[2].id, startTime: d(21, 16), endTime: d(23, 11), roomNumber: '118' },
  ];
  const bookings: Booking[] = [];
  for (const row of bookingData) {
    const [b] = await Booking.findOrCreate({
      where: { guestId: row.guestId, hotelId: row.hotelId, startTime: row.startTime } as any,
      defaults: row as any,
      paranoid: false,
    });
    await restoreIfSoftDeleted(b);
    bookings.push(b);
  }

  // ── Requests ─────────────────────────────────────────────────────────────────
  const requestData = [
    {
      hotelId: hotels[0].id, guestId: accounts[3].id, bookingId: bookings[0].id,
      requestType: RequestType.ROOM_SERVICE,
      userNotes: ['Please send to room 301', 'Extra napkins please'],
      staffNotes: ['Delivered at 19:30'],
      data: [{ name: 'Club Sandwich', quantity: 1, notes: 'No mayo' }, { name: 'Mineral Water', quantity: 2 }],
      urgency: RequestUrgency.MEDIUM, status: RequestStatus.COMPLETED,
    },
    {
      hotelId: hotels[0].id, guestId: accounts[3].id, bookingId: bookings[0].id,
      requestType: RequestType.HOUSE_KEEPING,
      userNotes: ['Need extra towels'], staffNotes: [],
      data: { instructions: 'Third floor, room 301' },
      urgency: RequestUrgency.LOW, status: RequestStatus.PENDING,
    },
    {
      hotelId: hotels[1].id, guestId: accounts[3].id, bookingId: bookings[1].id,
      requestType: RequestType.LAUNDRY,
      userNotes: [], staffNotes: ['Picked up at 09:00'],
      data: { items: ['2x Shirts', '1x Trousers'] },
      urgency: RequestUrgency.LOW, status: RequestStatus.PENDING,
    },
    {
      hotelId: hotels[0].id, guestId: accounts[4].id, bookingId: bookings[2].id,
      requestType: RequestType.AIRPORT_TRANSFER,
      userNotes: ['Flight lands at 14:00'], staffNotes: ['Driver assigned'],
      data: { flightNumber: 'BA 123', pickupTime: '14:30', terminal: '5' },
      urgency: RequestUrgency.HIGH, status: RequestStatus.PENDING,
    },
    {
      hotelId: hotels[2].id, guestId: accounts[4].id, bookingId: bookings[3].id,
      requestType: RequestType.ROOM_SERVICE,
      userNotes: [], staffNotes: [],
      data: [{ name: 'Breakfast set', quantity: 1 }],
      urgency: RequestUrgency.LOW, status: RequestStatus.PENDING,
    },
  ];
  for (const row of requestData) {
    const [request] = await Request.findOrCreate({
      where: { hotelId: row.hotelId, guestId: row.guestId, bookingId: row.bookingId, requestType: row.requestType } as any,
      defaults: row as any,
      paranoid: false,
    });
    await restoreIfSoftDeleted(request);
  }

  console.log('Seed completed.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
