import * as dotenv from 'dotenv';
import * as path from 'path';
import { Sequelize } from 'sequelize-typescript';
import { Op } from 'sequelize';
import { Account } from './accounts/accounts.model';
import { AccountRole, HotelMemberStatus } from './common/constants/constants.service';
import { Hotel } from './hotels/hotels.model';
import { HotelBrand } from './hotels/brands.model';
import { HotelAccount } from './hotels/hotel-accounts.model';
import { Booking } from './bookings/bookings.model';
import { BookingRoom } from './bookings/booking-rooms.model';
import { RoomType } from './rooms/room-types.model';
import { Room, RoomStatus } from './rooms/rooms.model';
import { RoomInventory } from './rooms/room-inventory.model';
import { Request, RequestType, RequestUrgency, RequestStatus } from './requests/requests.model';
import { Chat, ChatType } from './chat/chat.model';
import { ChatSummary } from './chat-summary/chat-summary.model';
import { Message, MessageRole } from './messages/message.model';
import { LlmEval, EvalDimension } from './llm-eval/llm-eval.model';
import { HotelIntegration, IntegrationStatus } from './integrations/hotel-integrations.model';
import { Organisation } from './organisations/organisations.model';
import { MenuItem, MenuItemCategory } from './restaurant/restaurant.model';
import { createHash } from 'crypto';

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
    models: [Account, Hotel, HotelBrand, HotelAccount, Booking, BookingRoom, RoomType, Room, RoomInventory, Request, Chat, ChatSummary, Message, MenuItem, LlmEval, HotelIntegration, Organisation],
    define: { underscored: true, timestamps: true, paranoid: true },
    dialectOptions: (process.env.DB_SSL === 'true' || process.env.DB_SSL === '1')
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : undefined,
  });

  await sequelize.authenticate();
  await sequelize.sync();

  // ── Organisations ───────────────────────────────────────────────────────────
  // Seeded before accounts because owners and staff reference one. Three of them,
  // with staff spread across two, so the owner-scoping rule is actually testable:
  // an owner in one must not see the other's people.
  const organisationData = [
    { name: 'Taj Group', description: 'Luxury hotels and palaces across India.' },
    { name: 'Marriott India', description: 'Marriott-operated properties in India.' },
    { name: 'Independent Hotels Co', description: 'Single-property independent operators.' },
  ];

  const organisations: Organisation[] = [];
  for (const row of organisationData) {
    const orgLookup: any = { where: { name: row.name }, defaults: row, paranoid: false };
    const [org] = await Organisation.findOrCreate(orgLookup);
    await restoreIfSoftDeleted(org);
    org.description = row.description;
    await org.save();
    organisations.push(org);
  }

  // ── Accounts ────────────────────────────────────────────────────────────────
  // uuid uses the `email:` form so seeded users can sign in via the email OTP flow.
  // Gmail plus-addressing: every OTP mail lands in the real flashpactone@gmail.com
  // inbox while each address stays a distinct account.
  // phone drives the voice phone bridge: callers are matched to accounts by the
  // trailing digits of their caller ID (see LLM.PHONE.CALLER_MATCH_DIGITS).
  // organisationId is null for the admin by design, not by omission: admins are
  // platform staff who sit outside every organisation. Guests get theirs from a
  // booking, so they carry none either.
  // Order matters: later sections index this array (accounts[3] and accounts[4]
  // are the guests that own the seeded bookings, chats and requests), so new
  // rows go on the end rather than in the middle.
  const accountData = [
    { uuid: 'email:flashpactone+admin@gmail.com',   email: 'flashpactone+admin@gmail.com',   name: 'Seed Admin',        role: AccountRole.ADMIN,       phone: '+919800000001', oauthMeta: {}, organisationId: null },
    { uuid: 'email:flashpactone+owner1@gmail.com',  email: 'flashpactone+owner1@gmail.com',  name: 'Hotel Owner One',   role: AccountRole.HOTEL_OWNER, phone: '+919800000002', oauthMeta: {}, organisationId: organisations[0].id },
    { uuid: 'email:flashpactone+staff1@gmail.com',  email: 'flashpactone+staff1@gmail.com',  name: 'Staff One',         role: AccountRole.HOTEL_STAFF, phone: '+919800000003', oauthMeta: {}, organisationId: organisations[0].id },
    { uuid: 'email:flashpactone+guest1@gmail.com',  email: 'flashpactone+guest1@gmail.com',  name: 'Guest One',         role: AccountRole.GUEST,       phone: '+919800000004', oauthMeta: {}, organisationId: null },
    { uuid: 'email:flashpactone+guest2@gmail.com',  email: 'flashpactone+guest2@gmail.com',  name: 'Guest Two',         role: AccountRole.GUEST,       phone: '+919800000005', oauthMeta: {}, organisationId: null },
    // Extra staff-side users so the Users screen has something to show, spread
    // across organisations so owner scoping is visible rather than theoretical.
    { uuid: 'email:flashpactone+staff2@gmail.com',  email: 'flashpactone+staff2@gmail.com',  name: 'Staff Two',         role: AccountRole.HOTEL_STAFF, phone: '+919800000006', oauthMeta: {}, organisationId: organisations[0].id },
    { uuid: 'email:flashpactone+owner2@gmail.com',  email: 'flashpactone+owner2@gmail.com',  name: 'Hotel Owner Two',   role: AccountRole.HOTEL_OWNER, phone: '+919800000007', oauthMeta: {}, organisationId: organisations[1].id },
    { uuid: 'email:flashpactone+staff3@gmail.com',  email: 'flashpactone+staff3@gmail.com',  name: 'Staff Three',       role: AccountRole.HOTEL_STAFF, phone: '+919800000008', oauthMeta: {}, organisationId: organisations[1].id },
    { uuid: 'email:flashpactone+owner3@gmail.com',  email: 'flashpactone+owner3@gmail.com',  name: 'Hotel Owner Three', role: AccountRole.HOTEL_OWNER, phone: '+919800000009', oauthMeta: {}, organisationId: organisations[2].id },
  ];
  const accounts: Account[] = [];
  for (const row of accountData) {
    // Keep one canonical account per email. Drop any other row holding the target
    // uuid (e.g. an empty account auto-created by the OTP login flow) so the uuid
    // can be assigned to the seeded, data-owning account without colliding.
    const canonical = await Account.findOne({ where: { email: row.email } as any, order: [['id', 'ASC']], paranoid: false });
    await Account.destroy({ where: { uuid: row.uuid, ...(canonical ? { id: { [Op.ne]: canonical.id } } : {}) } as any, force: true });
    const [acc] = await Account.findOrCreate({ where: { email: row.email } as any, defaults: row as any, paranoid: false });
    await restoreIfSoftDeleted(acc);
    acc.uuid = row.uuid;
    acc.name = row.name;
    acc.role = row.role;
    acc.organisationId = row.organisationId;
    acc.phone = row.phone;
    await acc.save();
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
      googleMapsUrl: 'https://www.google.com/maps?q=28.5446,77.1199',
      checkInTime: '15:00', checkOutTime: '12:00',
      hotelBrandId: brands['Radisson'].id,
      themeConfig: brands['Radisson'].themeConfig,
      images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800', 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800', 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800'],
    },
    {
      name: 'The Taj Mahal Palace',
      address: 'Apollo Bandar, Colaba, Mumbai, Maharashtra 400001',
      googleMapsUrl: 'https://www.google.com/maps?q=18.9220,72.8332',
      checkInTime: '14:00', checkOutTime: '12:00',
      hotelBrandId: brands['Taj Hotels'].id,
      themeConfig: brands['Taj Hotels'].themeConfig,
      images: ['https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800', 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800'],
    },
    {
      name: 'ITC Maurya',
      address: 'Sardar Patel Marg, Diplomatic Enclave, Chanakyapuri, New Delhi 110021',
      googleMapsUrl: 'https://www.google.com/maps?q=28.5984,77.1734',
      checkInTime: '14:00', checkOutTime: '12:00',
      hotelBrandId: brands['ITC Hotels'].id,
      themeConfig: brands['ITC Hotels'].themeConfig,
      images: ['https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800', 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800', 'https://images.unsplash.com/photo-1614609819764-5bc6c2f96e90?w=800'],
    },
    {
      name: 'Taj Cidade De Goa Horizon',
      address: 'Vainguinim Plateau, Panaji, Goa 403004',
      googleMapsUrl: 'https://www.google.com/maps?q=15.4734,73.8350',
      checkInTime: '14:00', checkOutTime: '12:00',
      hotelBrandId: brands['Taj Hotels'].id,
      themeConfig: brands['Taj Hotels'].themeConfig,
    },
    {
      name: 'JW Marriott Sahar',
      address: 'Sahar, Andheri East, Mumbai, Maharashtra 400099',
      googleMapsUrl: 'https://www.google.com/maps?q=19.0989,72.8686',
      checkInTime: '16:00', checkOutTime: '12:00',
      hotelBrandId: brands['Marriott'].id,
      themeConfig: brands['Marriott'].themeConfig,
    },
    {
      name: 'St. Regis Mumbai',
      address: '462, Senapati Bapat Marg, Lower Parel, Mumbai 400013',
      googleMapsUrl: 'https://www.google.com/maps?q=19.0130,72.8300',
      checkInTime: '15:00', checkOutTime: '12:00',
      hotelBrandId: brands['Marriott'].id,
      themeConfig: brands['Marriott'].themeConfig,
    },
    {
      name: 'Four Seasons Mumbai',
      address: '1/136, Dr. E Moses Road, Worli, Mumbai 400018',
      googleMapsUrl: 'https://www.google.com/maps?q=18.9940,72.8175',
      checkInTime: '15:00', checkOutTime: '12:00',
      hotelBrandId: brands['Four Seasons'].id,
      themeConfig: brands['Four Seasons'].themeConfig,
    },
    {
      name: 'Grand Hyatt Mumbai',
      address: 'Santacruz-Chembur Link Road, Mumbai 400055',
      googleMapsUrl: 'https://www.google.com/maps?q=19.0716,72.8487',
      checkInTime: '15:00', checkOutTime: '12:00',
      hotelBrandId: brands['Hyatt'].id,
      themeConfig: brands['Hyatt'].themeConfig,
    },
    {
      name: 'Burj Al Arab Jumeirah',
      address: 'Jumeirah Beach Road, Dubai, UAE',
      googleMapsUrl: 'https://www.google.com/maps?q=25.1412,55.1853',
      checkInTime: '15:00', checkOutTime: '12:00',
      hotelBrandId: brands['Jumeirah'].id,
      themeConfig: brands['Jumeirah'].themeConfig,
    },
    {
      name: 'The Lodhi',
      address: 'Lodhi Road, New Delhi 110003',
      googleMapsUrl: 'https://www.google.com/maps?q=28.5905,77.2360',
      checkInTime: '14:00', checkOutTime: '12:00',
    },
    {
      name: 'The Twin Towers Hotel New Kufri',
      address: 'Kufri, Shimla, Himachal Pradesh 171012',
      googleMapsUrl: 'https://www.google.com/maps?q=31.0980,77.2660',
      checkInTime: '12:00', checkOutTime: '10:00',
    },
    {
      name: 'Hotel de Paris Monte-Carlo',
      address: 'Place du Casino, 98000 Monaco',
      googleMapsUrl: 'https://www.google.com/maps?q=43.7396,7.4281',
      checkInTime: '15:00', checkOutTime: '12:00',
    },
    {
      name: "Badrutt's Palace Hotel St. Moritz",
      address: 'Via Serlas 27, 7500 St. Moritz, Switzerland',
      googleMapsUrl: 'https://www.google.com/maps?q=46.4976,9.8395',
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

  // ── Room Types & Rooms ───────────────────────────────────────────────────────
  // Every hotel gets the same three types so any hotel is bookable against
  // inventory, not just the first one. totalRooms counts only the rooms that are
  // actually sellable: a room under maintenance is excluded from findAvailableRooms,
  // so counting it here would let inventory promise a room that cannot be assigned.
  const roomTypeTemplates = [
    { name: 'Deluxe King', maxOccupancy: 2, firstRoom: 101, count: 12, unavailable: { 112: RoomStatus.MAINTENANCE } },
    { name: 'Twin Double', maxOccupancy: 4, firstRoom: 201, count: 8, unavailable: { 208: RoomStatus.OUT_OF_SERVICE } },
    { name: 'Executive Suite', maxOccupancy: 3, firstRoom: 301, count: 4, unavailable: {} },
  ];

  for (const hotel of hotels) {
    for (const template of roomTypeTemplates) {
      const roomNumbers = Array.from({ length: template.count }, (_, i) => template.firstRoom + i);
      const sellable = roomNumbers.filter((n) => !template.unavailable[n]).length;

      const roomTypeDefaults: any = {
        hotelId: hotel.id,
        name: template.name,
        maxOccupancy: template.maxOccupancy,
        totalRooms: sellable,
      };
      const [roomType] = await RoomType.findOrCreate({
        where: { hotelId: hotel.id, name: template.name },
        defaults: roomTypeDefaults,
        paranoid: false,
      });
      await restoreIfSoftDeleted(roomType);

      for (const roomNumber of roomNumbers) {
        const roomDefaults: any = {
          hotelId: hotel.id,
          roomTypeId: roomType.id,
          roomNumber: String(roomNumber),
          status: template.unavailable[roomNumber] || RoomStatus.ACTIVE,
        };
        const [room] = await Room.findOrCreate({
          where: { hotelId: hotel.id, roomNumber: String(roomNumber) },
          defaults: roomDefaults,
          paranoid: false,
        });
        await restoreIfSoftDeleted(room);
      }
    }
  }

  // ── Bookings ─────────────────────────────────────────────────────────────────
  const now = new Date();
  const d = (offsetDays: number, h = 15, m = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays, h, m, 0);

  const bookingData = [
    // Guest One is currently mid-stay so the guest portal/concierge is testable.
    // externalId links this row to the seeded PMS integration test token below.
    { guestId: accounts[3].id, hotelId: hotels[0].id, startTime: d(-1), endTime: d(2, 11), roomNumber: '301', externalId: 'pms-res-301' },
    { guestId: accounts[3].id, hotelId: hotels[1].id, startTime: d(14), endTime: d(16, 10), roomNumber: '512' },
    { guestId: accounts[4].id, hotelId: hotels[0].id, startTime: d(14), endTime: d(16, 10), roomNumber: '204' },
    { guestId: accounts[4].id, hotelId: hotels[2].id, startTime: d(21, 16), endTime: d(23, 11), roomNumber: '118' },
  ];
  const bookings: Booking[] = [];
  for (const row of bookingData) {
    const bookingWhere: any = { guestId: row.guestId, hotelId: row.hotelId, startTime: row.startTime };
    const bookingDefaults: any = row;
    const [b] = await Booking.findOrCreate({ where: bookingWhere, defaults: bookingDefaults, paranoid: false });
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
      externalId: 'pms-req-301-room-service',
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

  // ── Menu Items ───────────────────────────────────────────────────────────────
  // Serving windows are deliberately spread across the day: the menu search
  // returns only what is servable at the moment it runs, so an all-day set
  // would hide that filter entirely.
  const menuItems: any[] = [
    { hotelId: hotels[0].id, name: 'Masala Dosa', description: 'Crisp rice crepe with spiced potato and coconut chutney', price: 450, category: MenuItemCategory.BREAKFAST, availableStartTime: '07:00', availableEndTime: '10:30', dietaryTags: ['vegetarian', 'vegan'], sortOrder: 1 },
    { hotelId: hotels[0].id, name: 'Akuri on Toast', description: 'Parsi spiced scrambled eggs on brioche', price: 520, category: MenuItemCategory.BREAKFAST, availableStartTime: '07:00', availableEndTime: '10:30', dietaryTags: ['egg'], sortOrder: 2 },
    { hotelId: hotels[0].id, name: 'Dal Bukhara', description: 'Black lentils simmered overnight with tomato and butter', price: 950, category: MenuItemCategory.MAIN_COURSE, availableStartTime: '11:00', availableEndTime: '23:00', dietaryTags: ['vegetarian'], sortOrder: 3 },
    { hotelId: hotels[0].id, name: 'Tandoori Chicken', description: 'Half chicken marinated in yoghurt and spices, clay oven', price: 1150, category: MenuItemCategory.MAIN_COURSE, availableStartTime: '11:00', availableEndTime: '23:00', dietaryTags: [], sortOrder: 4 },
    { hotelId: hotels[0].id, name: 'Paneer Tikka', description: 'Char-grilled cottage cheese with peppers', price: 780, category: MenuItemCategory.APPETIZER, availableStartTime: '11:00', availableEndTime: '23:00', dietaryTags: ['vegetarian', 'gluten-free'], sortOrder: 5 },
    { hotelId: hotels[0].id, name: 'Gulab Jamun', description: 'Warm milk dumplings in cardamom syrup', price: 320, category: MenuItemCategory.DESSERT, availableStartTime: '12:00', availableEndTime: '23:00', dietaryTags: ['vegetarian'], sortOrder: 6 },
    { hotelId: hotels[0].id, name: 'Masala Chai', description: 'Assam tea with ginger and cardamom', price: 180, category: MenuItemCategory.BEVERAGE, availableStartTime: '06:00', availableEndTime: '23:30', dietaryTags: ['vegetarian'], sortOrder: 7 },
    { hotelId: hotels[0].id, name: 'Truffle Fries', description: 'Hand-cut fries, truffle oil, parmesan', price: 420, category: MenuItemCategory.SIDE, availableStartTime: '11:00', availableEndTime: '23:00', dietaryTags: ['vegetarian'], sortOrder: 8 },
    { hotelId: hotels[0].id, name: 'Seasonal Tasting Menu', description: 'Chef selection, currently off the menu', price: null, category: MenuItemCategory.DINNER, availableStartTime: '19:00', availableEndTime: '22:30', dietaryTags: [], sortOrder: 9, isAvailable: false },
    { hotelId: hotels[1].id, name: 'Bombay Sandwich', description: 'Grilled masala sandwich with mint chutney', price: 550, category: MenuItemCategory.SNACKS, availableStartTime: '11:00', availableEndTime: '19:00', dietaryTags: ['vegetarian'], sortOrder: 1 },
    { hotelId: hotels[1].id, name: 'Goan Fish Curry', description: 'Kingfish in coconut and kokum gravy with rice', price: 1290, category: MenuItemCategory.MAIN_COURSE, availableStartTime: '12:00', availableEndTime: '23:00', dietaryTags: ['gluten-free'], sortOrder: 2 },
    { hotelId: hotels[1].id, name: 'Bhelpuri', description: 'Puffed rice, tamarind, onion and coriander', price: 340, category: MenuItemCategory.APPETIZER, availableStartTime: '11:00', availableEndTime: '20:00', dietaryTags: ['vegetarian', 'vegan'], sortOrder: 3 },
    { hotelId: hotels[1].id, name: 'Filter Coffee', description: 'South Indian coffee, chicory blend', price: 160, category: MenuItemCategory.BEVERAGE, availableStartTime: '06:00', availableEndTime: '22:00', dietaryTags: ['vegetarian'], sortOrder: 4 },
    { hotelId: hotels[2].id, name: 'Dum Pukht Biryani', description: 'Sealed-pot lamb biryani with saffron', price: 1450, category: MenuItemCategory.MAIN_COURSE, availableStartTime: '12:00', availableEndTime: '23:00', dietaryTags: [], sortOrder: 1 },
    { hotelId: hotels[2].id, name: 'Kakori Kebab', description: 'Smoked minced lamb skewers', price: 990, category: MenuItemCategory.APPETIZER, availableStartTime: '12:00', availableEndTime: '23:00', dietaryTags: [], sortOrder: 2 },
    { hotelId: hotels[2].id, name: 'Phirni', description: 'Slow-cooked rice pudding with rose', price: 380, category: MenuItemCategory.DESSERT, availableStartTime: '12:00', availableEndTime: '23:00', dietaryTags: ['vegetarian'], sortOrder: 3 },
  ];

  for (const row of menuItems) {
    const menuKey: any = { hotelId: row.hotelId, name: row.name };
    const menuDefaults: any = { ...row, isAvailable: row.isAvailable ?? true };
    const [menuItem] = await MenuItem.findOrCreate({ where: menuKey, defaults: menuDefaults, paranoid: false });
    await restoreIfSoftDeleted(menuItem);
  }

  // ── PMS Integration ──────────────────────────────────────────────────────────
  // Fixed, documented dev/test token (never a real generated secret) so anyone
  // running seed can immediately curl the webhook routes for hotels[0]. Hashed
  // with the same algorithm HotelIntegrationsService uses, so it validates
  // exactly like a real generated token would.
  const devIntegrationToken = 'dev-test-integration-token-do-not-use-in-prod';
  const devIntegrationTokenHash = createHash('sha256').update(devIntegrationToken).digest('hex');
  await HotelIntegration.findOrCreate({
    where: { hotelId: hotels[0].id },
    defaults: {
      hotelId: hotels[0].id,
      tokenHash: devIntegrationTokenHash,
      tokenPrefix: devIntegrationToken.slice(0, 8),
      status: IntegrationStatus.ACTIVE,
      createdByAccountId: accounts[1].id,
    } as any,
  });

  // ── Chats, Messages & LLM Evals ─────────────────────────────────────────────
  const judgeModel = 'google/gemini-3.1-flash-lite';

  const chatData: any[] = [
    {
      accountId: accounts[3].id, bookingId: bookings[0].id, chatType: ChatType.BOOKING, languageCode: 'en',
      messages: [
        { role: MessageRole.USER, content: 'Can you send up two extra towels and a bottle of water?' },
        {
          role: MessageRole.ASSISTANT,
          content: "I've requested two extra towels and a bottle of water for room 301 — housekeeping will bring them shortly.",
          toolCalls: [{ toolName: 'create_request', toolCallId: 'seed-tc-1', input: { requestType: 'house_keeping', items: ['towels', 'water'] }, output: { success: true } }],
          evals: [
            { dimension: EvalDimension.TOOL_CALL, passed: true, reasoning: "The tool call correctly matched the guest's housekeeping request with the right items." },
            { dimension: EvalDimension.RESPONSE_QUALITY, passed: true, reasoning: 'Response confirmed the action clearly and concisely.' },
          ],
        },
        { role: MessageRole.USER, content: 'Thanks! Also what time is breakfast served?' },
        {
          role: MessageRole.ASSISTANT,
          content: 'Breakfast is served from 7:00 AM to 10:30 AM at the main restaurant on the ground floor.',
          evals: [
            { dimension: EvalDimension.RESPONSE_QUALITY, passed: true, reasoning: 'Accurately answered the breakfast timing question without unnecessary tool use.' },
            { dimension: EvalDimension.SUMMARY_ACCURACY, passed: true, reasoning: 'The rolling summary faithfully captured the towel/water request and breakfast query without inventing facts.' },
          ],
        },
      ],
    },
    {
      accountId: accounts[4].id, bookingId: bookings[3].id, chatType: ChatType.BOOKING, languageCode: 'en',
      messages: [
        { role: MessageRole.USER, content: "I'd like to book an airport transfer for tomorrow morning." },
        {
          role: MessageRole.ASSISTANT,
          content: 'Sure, could you share your flight number and pickup time so I can arrange the transfer?',
          evals: [{ dimension: EvalDimension.RESPONSE_QUALITY, passed: true, reasoning: 'Appropriately asked a clarifying question before taking action.' }],
        },
        { role: MessageRole.USER, content: 'Flight 6E 202, pickup at 6am.' },
        {
          role: MessageRole.ASSISTANT,
          content: 'Got it! Airport transfer booked for 6:00 AM ahead of flight 6E 202.',
          toolCalls: [{ toolName: 'create_request', toolCallId: 'seed-tc-2', input: { requestType: 'airport_transfer', flightNumber: '6E 202', pickupTime: '06:00' }, output: { success: true } }],
          evals: [
            { dimension: EvalDimension.TOOL_CALL, passed: false, reasoning: "Tool was invoked before confirming the guest's pickup address and terminal, risking an incomplete request." },
            { dimension: EvalDimension.RESPONSE_QUALITY, passed: true, reasoning: 'Confirmed the booking back to the guest clearly.' },
          ],
        },
      ],
    },
    // Public reservation agent: anonymous (no account), scoped to a hotel
    // rather than a booking. The enquiry it gathered is the
    // record_reservation_enquiry tool call — there is no reservations table.
    {
      accountId: null, bookingId: null, hotelId: hotels[0].id, chatType: ChatType.RESERVATION,
      languageCode: 'en', chatName: 'Weekend Stay Enquiry',
      messages: [
        { role: MessageRole.USER, content: 'Hi, do you have a room for two nights this weekend?' },
        {
          role: MessageRole.ASSISTANT,
          content: "We'd love to host you. Could you confirm the dates you have in mind, and how many guests will be staying?",
          evals: [{ dimension: EvalDimension.RESPONSE_QUALITY, passed: true, reasoning: 'Asked for the dates and party size before recording anything.' }],
        },
        { role: MessageRole.USER, content: 'Friday to Sunday, two adults. I am Priya Nair, priya.nair@example.com.' },
        {
          role: MessageRole.ASSISTANT,
          content: "Thank you, Priya — I've passed your enquiry for two adults, checking in Friday and out on Sunday, to our reservations team. They'll confirm availability and rates with you by email shortly.",
          toolCalls: [{
            toolName: 'record_reservation_enquiry',
            toolCallId: 'seed-tc-3',
            input: { guestName: 'Priya Nair', guestEmail: 'priya.nair@example.com', checkInDate: '2026-09-11', checkOutDate: '2026-09-13', partySize: 2 },
            output: { success: true, message: 'Reservation enquiry recorded' },
          }],
          evals: [
            { dimension: EvalDimension.TOOL_CALL, passed: true, reasoning: 'Recorded the enquiry only once every required detail had been confirmed.' },
            { dimension: EvalDimension.RESPONSE_QUALITY, passed: true, reasoning: 'Set the right expectation: the hotel team confirms, not the agent.' },
          ],
        },
      ],
    },
    {
      accountId: null, bookingId: null, hotelId: hotels[1].id, chatType: ChatType.RESERVATION,
      languageCode: 'en', chatName: 'Family Room Enquiry',
      messages: [
        { role: MessageRole.USER, content: 'What time is check-in, and is breakfast included for kids?' },
        {
          role: MessageRole.ASSISTANT,
          content: 'Check-in opens at 2:00 PM and breakfast runs 7:00–10:30 AM. Were you looking at dates for a family stay?',
          toolCalls: [{ toolName: 'get_hotel_details', toolCallId: 'seed-tc-4', input: {}, output: { success: true } }],
          evals: [{ dimension: EvalDimension.TOOL_CALL, passed: true, reasoning: 'Read the property details rather than guessing check-in and breakfast hours.' }],
        },
      ],
    },
  ];

  for (const row of chatData) {
    const chatKey: any = { accountId: row.accountId, bookingId: row.bookingId, hotelId: row.hotelId ?? null };
    // Reservation chats share a null account and booking, so their seeded name
    // is what keeps findOrCreate from folding them into one row.
    if (row.chatName) {
      chatKey.chatName = row.chatName;
    }
    const chatDefaults: any = { ...chatKey, chatType: row.chatType, languageCode: row.languageCode };
    const [chat] = await Chat.findOrCreate({ where: chatKey, defaults: chatDefaults, paranoid: false });
    await restoreIfSoftDeleted(chat);

    const existingMessageCount = await Message.count({ where: { chatId: chat.id } });
    if (existingMessageCount > 0) {
      continue;
    }

    for (const msg of row.messages) {
      const messageData: any = {
        chatId: chat.id,
        role: msg.role,
        content: msg.content,
        toolCalls: msg.toolCalls ?? null,
      };
      const message = await Message.create(messageData);

      for (const evalRow of msg.evals ?? []) {
        const evalData: any = {
          chatId: chat.id,
          messageId: message.id,
          dimension: evalRow.dimension,
          passed: evalRow.passed,
          reasoning: evalRow.reasoning,
          judgeModel,
        };
        await LlmEval.create(evalData);
      }
    }

    // Chat-level eval example (no message reference): the generated chat title.
    const chatTitleEval: any = {
      chatId: chat.id,
      messageId: null,
      dimension: EvalDimension.CHAT_TITLE,
      passed: true,
      reasoning: 'Three-word title concisely reflects the conversation topic.',
      judgeModel,
    };
    await LlmEval.create(chatTitleEval);
  }

  // Flow-level eval examples (no chat/message context): extraction pipelines.
  const taskEvalExamples: any[] = [
    { dimension: EvalDimension.DOCUMENT_EXTRACTION, passed: true, reasoning: 'Extracted dates, guest email, and room number match the reservation image.' },
    { dimension: EvalDimension.MENU_OCR, passed: true, reasoning: 'Items are well-formed dishes with plausible prices and valid categories.' },
    { dimension: EvalDimension.ONBOARDING_EXTRACTION, passed: false, reasoning: 'Check-in time was returned as 14:00 but the crawl data never states it.' },
  ];
  for (const example of taskEvalExamples) {
    const taskWhere: any = { dimension: example.dimension };
    const exists = await LlmEval.count({ where: taskWhere });
    if (exists === 0) {
      const taskEvalData: any = { chatId: null, messageId: null, judgeModel, ...example };
      await LlmEval.create(taskEvalData);
    }
  }

  console.log(`PMS integration test token for hotel "${hotels[0].name}" (id ${hotels[0].id}): ${devIntegrationToken}`);
  console.log('Seed completed.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
