import * as dotenv from 'dotenv';
import * as path from 'path';
import { Sequelize } from 'sequelize-typescript';
import { Account } from './accounts/accounts.model';
import { AccountRole } from './common/constants/constants.service';
import { Hotel } from './hotels/hotels.model';
import { HotelAccount } from './hotels/hotel-accounts.model';
import { Booking } from './bookings/bookings.model';
import { Request, RequestType, RequestUrgency, RequestStatus } from './requests/requests.model';

// Load environment variables from env file (same pattern as NestJS app)
const nodeEnv = process.env.NODE_ENV || 'dev';
const envFile = 'prod.env';
dotenv.config({ path: path.resolve(__dirname, `../${envFile}`) });

async function seed() {
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = parseInt(process.env.DB_PORT || '5432', 10);
  const dbUsername = process.env.DB_USERNAME || 'postgres';
  const dbPassword = process.env.DB_PASSWORD || 'postgres';
  const dbName = process.env.DB_NAME || 'profile_aura';
  const dbSsl = process.env.DB_SSL === 'true' || process.env.DB_SSL === '1';

  const sequelize = new Sequelize({
    dialect: 'postgres',
    host: dbHost,
    port: dbPort,
    username: dbUsername,
    password: dbPassword,
    database: dbName,
    logging: false,
    models: [Account, Hotel, HotelAccount, Booking, Request],
    define: {
      underscored: true,
      timestamps: true,
    },
    dialectOptions: dbSsl
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : undefined,
  });

  await sequelize.authenticate();
  await sequelize.sync({ alter: true });

  const accountData = [
    { uuid: 'seed-admin-1', email: 'admin@seed.com', name: 'Seed Admin', role: AccountRole.ADMIN, oauthMeta: {} },
    { uuid: 'seed-owner-1', email: 'owner1@seed.com', name: 'Hotel Owner One', role: AccountRole.HOTEL_OWNER, oauthMeta: {} },
    { uuid: 'seed-staff-1', email: 'staff1@seed.com', name: 'Staff One', role: AccountRole.HOTEL_STAFF, oauthMeta: {} },
    { uuid: 'seed-guest-1', email: 'guest1@seed.com', name: 'Guest One', role: AccountRole.GUEST, oauthMeta: {} },
    { uuid: 'seed-guest-2', email: 'guest2@seed.com', name: 'Guest Two', role: AccountRole.GUEST, oauthMeta: {} },
  ];

  const accounts: Account[] = [];
  for (const row of accountData) {
    const rowAny: any = { ...row };
    const [acc] = await Account.upsert(rowAny);
    accounts.push(acc);
  }

  const hotelData = [
    { name: 'Grand Plaza', address: '1 Main St', checkInTime: '15:00', checkOutTime: '11:00' },
    { name: 'Seaside Inn', address: '2 Ocean Ave', checkInTime: '14:00', checkOutTime: '10:00' },
    { name: 'Mountain Lodge', address: '3 Peak Rd', checkInTime: '16:00', checkOutTime: '11:00' },
  ];

  const hotels: Hotel[] = [];
  for (const row of hotelData) {
    const rowAny: any = row;
    const [h] = await Hotel.findOrCreate({
      where: { name: row.name },
      defaults: rowAny,
    });
    hotels.push(h);
  }

  await HotelAccount.findOrCreate({
    where: { hotelId: hotels[0].id, accountId: accounts[1].id },
    defaults: { hotelId: hotels[0].id, accountId: accounts[1].id },
  });
  await HotelAccount.findOrCreate({
    where: { hotelId: hotels[0].id, accountId: accounts[2].id },
    defaults: { hotelId: hotels[0].id, accountId: accounts[2].id },
  });
  await HotelAccount.findOrCreate({
    where: { hotelId: hotels[1].id, accountId: accounts[1].id },
    defaults: { hotelId: hotels[1].id, accountId: accounts[1].id },
  });
  await HotelAccount.findOrCreate({
    where: { hotelId: hotels[2].id, accountId: accounts[1].id },
    defaults: { hotelId: hotels[2].id, accountId: accounts[1].id },
  });

  const now = new Date();
  const start1 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 15, 0, 0);
  const end1 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 9, 11, 0, 0);
  const start2 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14, 14, 0, 0);
  const end2 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 16, 10, 0, 0);
  const start3 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 21, 16, 0, 0);
  const end3 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 23, 11, 0, 0);

  const bookingData = [
    { guestId: accounts[3].id, hotelId: hotels[0].id, startTime: start1, endTime: end1 },
    { guestId: accounts[3].id, hotelId: hotels[1].id, startTime: start2, endTime: end2 },
    { guestId: accounts[4].id, hotelId: hotels[0].id, startTime: start2, endTime: end2 },
    { guestId: accounts[4].id, hotelId: hotels[2].id, startTime: start3, endTime: end3 },
  ];

  const bookings: Booking[] = [];
  for (const row of bookingData) {
    const whereAny: any = {
      guestId: row.guestId,
      hotelId: row.hotelId,
      startTime: row.startTime,
    };
    const rowAny: any = row;
    const [b] = await Booking.findOrCreate({
      where: whereAny,
      defaults: rowAny,
    });
    bookings.push(b);
  }

  const requestData = [
    {
      hotelId: hotels[0].id,
      guestId: accounts[3].id,
      bookingId: bookings[0].id,
      requestType: RequestType.ROOM_SERVICE,
      userNotes: ['Please send to room 101', 'Extra napkins please'],
      staffNotes: ['Delivered at 19:30'],
      data: [
        { name: 'Club Sandwich', quantity: 1, notes: 'No mayo' },
        { name: 'Mineral Water', quantity: 2 },
      ],
      urgency: RequestUrgency.MEDIUM,
      status: RequestStatus.COMPLETED,
    },
    {
      hotelId: hotels[0].id,
      guestId: accounts[3].id,
      bookingId: bookings[0].id,
      requestType: RequestType.HOUSE_KEEPING,
      userNotes: ['Need extra towels'],
      staffNotes: [],
      data: { instructions: 'Second floor, room 101' },
      urgency: RequestUrgency.LOW,
      status: RequestStatus.PENDING,
    },
    {
      hotelId: hotels[1].id,
      guestId: accounts[3].id,
      bookingId: bookings[1].id,
      requestType: RequestType.LAUNDRY,
      userNotes: [],
      staffNotes: ['Picked up at 09:00'],
      data: { items: ['2x Shirts', '1x Trousers'] },
      urgency: RequestUrgency.LOW,
      status: RequestStatus.PENDING,
    },
    {
      hotelId: hotels[0].id,
      guestId: accounts[4].id,
      bookingId: bookings[2].id,
      requestType: RequestType.AIRPORT_TRANSFER,
      userNotes: ['Flight lands at 14:00'],
      staffNotes: ['Driver assigned'],
      data: { flightNumber: 'BA 123', pickupTime: '14:30', terminal: '5' },
      urgency: RequestUrgency.HIGH,
      status: RequestStatus.PENDING,
    },
    {
      hotelId: hotels[2].id,
      guestId: accounts[4].id,
      bookingId: bookings[3].id,
      requestType: RequestType.ROOM_SERVICE,
      userNotes: [],
      staffNotes: [],
      data: [{ name: 'Breakfast set', quantity: 1 }],
      urgency: RequestUrgency.LOW,
      status: RequestStatus.PENDING,
    },
  ];

  for (const row of requestData) {
    const whereAny: any = {
      hotelId: row.hotelId,
      guestId: row.guestId,
      bookingId: row.bookingId,
      requestType: row.requestType,
    };
    const rowAny: any = row;
    await Request.findOrCreate({
      where: whereAny,
      defaults: rowAny,
    });
  }

  console.log('Seed completed.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
