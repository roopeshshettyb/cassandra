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
import { Request, RequestType, RequestUrgency, RequestStatus } from './requests/requests.model';
import { Chat, ChatType } from './chat/chat.model';
import { ChatSummary } from './chat-summary/chat-summary.model';
import { Message, MessageRole } from './messages/message.model';
import { LlmEval, EvalDimension } from './llm-eval/llm-eval.model';

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
    models: [Account, Hotel, HotelBrand, HotelAccount, Booking, Request, Chat, ChatSummary, Message, LlmEval],
    define: { underscored: true, timestamps: true, paranoid: true },
    dialectOptions: (process.env.DB_SSL === 'true' || process.env.DB_SSL === '1')
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : undefined,
  });

  await sequelize.authenticate();
  await sequelize.sync();

  // ── Accounts ────────────────────────────────────────────────────────────────
  // uuid uses the `email:` form so seeded users can sign in via the email OTP flow.
  // Gmail plus-addressing: every OTP mail lands in the real flashpactone@gmail.com
  // inbox while each address stays a distinct account.
  // phone drives the voice phone bridge: callers are matched to accounts by the
  // trailing digits of their caller ID (see LLM.PHONE.CALLER_MATCH_DIGITS).
  const accountData = [
    { uuid: 'email:flashpactone+admin@gmail.com',  email: 'flashpactone+admin@gmail.com',  name: 'Seed Admin',      role: AccountRole.ADMIN,       phone: '+919800000001', oauthMeta: {} },
    { uuid: 'email:flashpactone+owner1@gmail.com', email: 'flashpactone+owner1@gmail.com', name: 'Hotel Owner One', role: AccountRole.HOTEL_OWNER, phone: '+919800000002', oauthMeta: {} },
    { uuid: 'email:flashpactone+staff1@gmail.com', email: 'flashpactone+staff1@gmail.com', name: 'Staff One',       role: AccountRole.HOTEL_STAFF, phone: '+919800000003', oauthMeta: {} },
    { uuid: 'email:flashpactone+guest1@gmail.com', email: 'flashpactone+guest1@gmail.com', name: 'Guest One',       role: AccountRole.GUEST,       phone: '+919800000004', oauthMeta: {} },
    { uuid: 'email:flashpactone+guest2@gmail.com', email: 'flashpactone+guest2@gmail.com', name: 'Guest Two',       role: AccountRole.GUEST,       phone: '+919800000005', oauthMeta: {} },
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

  // ── Bookings ─────────────────────────────────────────────────────────────────
  const now = new Date();
  const d = (offsetDays: number, h = 15, m = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays, h, m, 0);

  const bookingData = [
    // Guest One is currently mid-stay so the guest portal/concierge is testable
    { guestId: accounts[3].id, hotelId: hotels[0].id, startTime: d(-1), endTime: d(2, 11), roomNumber: '301' },
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
  ];

  for (const row of chatData) {
    const chatKey: any = { accountId: row.accountId, bookingId: row.bookingId };
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

  console.log('Seed completed.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
