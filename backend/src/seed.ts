import * as dotenv from 'dotenv';
import * as path from 'path';
import { Sequelize } from 'sequelize-typescript';
import { Account } from './accounts/accounts.model';
import { AccountRole } from './common/constants/account-roles.constants';
import { Hotel } from './hotels/hotels.model';
import { HotelAccount } from './hotels/hotel-accounts.model';
import { Booking } from './bookings/bookings.model';

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
    models: [Account, Hotel, HotelAccount, Booking],
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
    const [acc] = await Account.upsert({ ...row } as any);
    accounts.push(acc);
  }

  const hotelData = [
    { name: 'Grand Plaza', address: '1 Main St', checkInTime: '15:00', checkOutTime: '11:00' },
    { name: 'Seaside Inn', address: '2 Ocean Ave', checkInTime: '14:00', checkOutTime: '10:00' },
    { name: 'Mountain Lodge', address: '3 Peak Rd', checkInTime: '16:00', checkOutTime: '11:00' },
  ];

  const hotels: Hotel[] = [];
  for (const row of hotelData) {
    const [h] = await Hotel.findOrCreate({
      where: { name: row.name },
      defaults: row as any,
    });
    hotels.push(h);
  }

  await HotelAccount.findOrCreate({
    where: { hotelId: hotels[0].id, accountId: accounts[1].id },
    defaults: { hotelId: hotels[0].id, accountId: accounts[1].id } as any,
  });
  await HotelAccount.findOrCreate({
    where: { hotelId: hotels[0].id, accountId: accounts[2].id },
    defaults: { hotelId: hotels[0].id, accountId: accounts[2].id } as any,
  });
  await HotelAccount.findOrCreate({
    where: { hotelId: hotels[1].id, accountId: accounts[1].id },
    defaults: { hotelId: hotels[1].id, accountId: accounts[1].id } as any,
  });
  await HotelAccount.findOrCreate({
    where: { hotelId: hotels[2].id, accountId: accounts[1].id },
    defaults: { hotelId: hotels[2].id, accountId: accounts[1].id } as any,
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

  for (const row of bookingData) {
    await Booking.findOrCreate({
      where: {
        guestId: row.guestId,
        hotelId: row.hotelId,
        startTime: row.startTime,
      } as any,
      defaults: row as any,
    });
  }

  console.log('Seed completed.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
