import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { AgentToolContext } from './langgraph-tools.context';
import { BookingsService } from '../bookings/bookings.service';
import { RequestsService } from '../requests/requests.service';
import { RestaurantService } from '../restaurant/restaurant.service';
import { ChatService } from '../chat/chat.service';
import { HotelsService } from '../hotels/hotels.service';
import { CostsService } from '../costs/costs.service';
import { Booking } from '../bookings/bookings.model';
import { Account } from '../accounts/accounts.model';
import { Hotel } from '../hotels/hotels.model';
import { RequestType, RequestUrgency, RequestStatus } from '../requests/requests.model';
import { AccountRole } from '../common/constants/constants.service';
import { CreateRequestDto } from '../requests/requests.dto';
import { Op } from 'sequelize';

export interface AllRounderDeps {
  hotelsService: HotelsService;
  costsService: CostsService;
  bookingsService: BookingsService;
  bookingsRepository: typeof Booking;
}

function getTodayRange(): { todayStart: Date; todayEnd: Date } {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  return { todayStart, todayEnd };
}

async function verifyHotelAccess(hotelsService: HotelsService, account: any, hotelId: number): Promise<any | null> {
  const allHotels = await hotelsService.findAllForAccount(account);
  return allHotels.data.find((h: any) => h.id === hotelId) || null;
}

export function createAgentTools(
  ctx: AgentToolContext,
  bookingsService: BookingsService,
  requestsService: RequestsService,
  restaurantService: RestaurantService,
  chatService: ChatService,
  allRounderDeps?: AllRounderDeps,
): DynamicStructuredTool[] {
  const { account, bookingId, chatId, hotel, booking, languageCode, scopedHotelIds } = ctx;
  const bookingAny: any = booking;

  type ToolDef = { allowedRoles: Partial<Record<AccountRole, boolean>>; tool: DynamicStructuredTool };

  const toolDefs: ToolDef[] = [
    {
      allowedRoles: { [AccountRole.GUEST]: true, [AccountRole.HOTEL_STAFF]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'create_request',
      description:
        'Create a new service request for the current booking (e.g. room service, housekeeping, laundry, airport transfer). Use the current booking context; do not ask for hotel or guest ids.',
      schema: z.object({
        requestType: z.nativeEnum(RequestType),
        urgency: z.nativeEnum(RequestUrgency),
        userNotes: z.array(z.string()).optional(),
        data: z.record(z.string(), z.unknown()).optional(),
      }),
      func: async (args) => {
        const hotelId = bookingAny?.hotelId;
        const guestId = bookingAny?.guestId;
        const nowIso = new Date().toISOString();
        const userNotes: { text: string; addedAt: string }[] = [];
        for (const text of (args.userNotes ?? [])) userNotes.push({ text, addedAt: nowIso });

        const dto: CreateRequestDto = {
          hotelId,
          guestId,
          bookingId,
          requestType: args.requestType,
          urgency: args.urgency,
          userNotes,
          chatId,
          ...(args.data != null && { data: args.data }),
        };
        const result = await requestsService.create(dto, account);
        return JSON.stringify(result);
      },
    }),
    },
    {
      allowedRoles: { [AccountRole.GUEST]: true, [AccountRole.HOTEL_STAFF]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'update_request',
      description: 'Update an existing request (e.g. status, urgency, or custom data).',
      schema: z.object({
        requestId: z.number().describe('The id of the request to update'),
        urgency: z.nativeEnum(RequestUrgency).optional(),
        status: z.nativeEnum(RequestStatus).optional(),
        data: z.record(z.string(), z.unknown()).optional(),
      }),
      func: async (args) => {
        const { requestId, ...rest } = args;
        const result = await requestsService.update(requestId, rest, account);
        return JSON.stringify(result);
      },
    }),
    },
    {
      allowedRoles: { [AccountRole.GUEST]: true, [AccountRole.HOTEL_STAFF]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'get_pending_requests',
      description: 'Get all pending requests for the current booking (status is pending). Use this to summarize or act on outstanding requests.',
      schema: z.object({}),
      func: async () => {
        const pending = await requestsService.findByBookingId(bookingId, account, RequestStatus.PENDING);
        return JSON.stringify(pending);
      },
    }),
    },
    {
      allowedRoles: { [AccountRole.GUEST]: true, [AccountRole.HOTEL_STAFF]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'append_message',
      description: 'Append a message to an existing request. If the current speaker is a guest, it will be added as a user note; if hotel owner/staff, it will be added as a staff note.',
      schema: z.object({
        requestId: z.number().describe('The id of the request to update'),
        message: z.string().describe('The message to append as a note'),
      }),
      func: async (args) => {
        // Route to the appropriate append method based on the current account role.
        if (account.role === AccountRole.GUEST) {
          const result = await requestsService.appendUserMessage(args.requestId, args.message, account);
          return JSON.stringify(result);
        }

        // Admins, hotel owners, and hotel staff should write staff notes.
        const result = await requestsService.appendStaffMessage(args.requestId, args.message, account);
        return JSON.stringify(result);
      },
    }),
    },
    {
      allowedRoles: { [AccountRole.GUEST]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'get_booking',
      description: 'Get the current booking details (dates, hotel, etc.). Use this to answer guest questions about this booking.',
      schema: z.object({}),
      func: async () => {
        return JSON.stringify(booking ?? { error: 'No booking in context' });
      },
    }),
    },
    {
      allowedRoles: { [AccountRole.GUEST]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'get_hotel',
      description:
        'Get the hotel information for the current booking (name, address, check-in/out times, amenities hours, wifi, etc.). Use this to answer guest questions about the hotel associated with this booking.',
      schema: z.object({}),
      func: async () => {
        return JSON.stringify(hotel);
      },
    }),
    },
    {
      allowedRoles: { [AccountRole.GUEST]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'set_chat_language',
      description:
        'Propose setting the language for this chat to one of the supported languages (English, Hindi, Kannada, Tamil, or Telugu). This tool does not itself change any configuration; the application will apply the chosen language.',
      schema: z.object({
        languageCode: z
          .enum(['en', 'hi', 'kn', 'ta', 'te'])
          .describe('The ISO-639-1 language code to use for this chat (en, hi, kn, ta, or te).'),
        reason: z
          .string()
          .optional()
          .describe('Optional explanation for why the language is being changed.'),
      }),
      func: async (args) => {
        const previous = languageCode ?? null;
        const next = args.languageCode;
        await chatService.updateLanguageCode(chatId, next);
        return JSON.stringify({
          previousLanguageCode: previous,
          nextLanguageCode: next,
          reason: args.reason ?? null,
        });
      },
    }),
    },
    {
      allowedRoles: { [AccountRole.GUEST]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'search_restaurant_menu',
      description:
        'Search the restaurant menu for the current hotel. Use when guests ask about menu items, food options, prices, vegetarian/vegan options, dietary restrictions, or what is available to order. Returns available menu items (name, description, price, category, dietary tags, available times).',
      schema: z.object({
        keywords: z
          .string()
          .optional()
          .describe('Comma-separated search terms to filter by name or description (e.g. "vegetarian, pasta, gluten-free")'),
      }),
      func: async (args) => {
        const hotelId = bookingAny?.hotelId;
        if (!hotelId) {
          return JSON.stringify({ error: 'No hotel in booking context' });
        }
        const result = await restaurantService.searchMenuItems(hotelId, account, {
          booking: bookingAny ? { hotelId, guestId: bookingAny.guestId } : undefined,
          keywords: args.keywords,
        });
        return JSON.stringify(result.data);
      },
    }),
    },
  ];

  // ── AllRounder tools (only when deps provided — i.e. AllRounder context) ───
  if (allRounderDeps) {
    const { hotelsService, costsService, bookingsService: bSvc, bookingsRepository } = allRounderDeps;

    toolDefs.push({
      allowedRoles: { [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'list_my_hotels',
        description: 'List all hotels this account has access to.',
        schema: z.object({}),
        func: async () => {
          const result = await hotelsService.findAllForAccount(account);
          const hotels: any[] = [];
          for (const h of result.data) { const hotel: any = h; hotels.push({ id: hotel.id, name: hotel.name, address: hotel.address ?? null, _card_type: 'hotel' }); }
          return JSON.stringify(hotels);
        },
      }),
    });

    toolDefs.push({
      allowedRoles: { [AccountRole.HOTEL_STAFF]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'list_requests',
        description: 'Search and list service requests by hotel, status, urgency, type, guest name, or room number.',
        schema: z.object({
          hotelId: z.number().optional(),
          status: z.nativeEnum(RequestStatus).optional(),
          urgency: z.nativeEnum(RequestUrgency).optional(),
          requestType: z.nativeEnum(RequestType).optional(),
          guestName: z.string().optional(),
          roomNumber: z.string().optional(),
          limit: z.number().optional(),
        }),
        func: async (args) => {
          const result = await requestsService.findAllForAccount(account);
          let requests: any[] = result.data;
          if (args.hotelId) requests = requests.filter((r: any) => Number(r.hotelId) === Number(args.hotelId));
          if (args.status) requests = requests.filter((r: any) => r.status === args.status);
          if (args.urgency) requests = requests.filter((r: any) => r.urgency === args.urgency);
          if (args.requestType) requests = requests.filter((r: any) => r.requestType === args.requestType);
          if (args.guestName) { const q = args.guestName.toLowerCase(); requests = requests.filter((r: any) => r.guest?.name?.toLowerCase().includes(q)); }
          if (args.roomNumber) requests = requests.filter((r: any) => String(r.booking?.roomNumber) === String(args.roomNumber));
          requests = requests.slice(0, args.limit ?? 10);
          const mapped: any[] = [];
          for (const r of requests) mapped.push({ id: r.id, requestType: r.requestType, status: r.status, urgency: r.urgency, guestName: r.guest?.name ?? null, hotelName: r.hotel?.name ?? null, roomNumber: r.booking?.roomNumber ?? null, bookingId: r.bookingId, createdAt: r.createdAt, _card_type: 'request' });
          return JSON.stringify(mapped);
        },
      }),
    });

    toolDefs.push({
      allowedRoles: { [AccountRole.HOTEL_STAFF]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'get_hotel_stats',
        description: 'Get hotel stats overview/dashboard: pending request count, high-priority count, in-progress count, today check-ins and check-outs. Use this when user asks for "stats", "overview", "dashboard", or "summary" of a hotel.',
        schema: z.object({ hotelId: z.number() }),
        func: async (args) => {
          const hotelRecord = await verifyHotelAccess(hotelsService, account, args.hotelId);
          if (!hotelRecord) return JSON.stringify({ error: 'Hotel not found or no access' });
          const requestResult = await requestsService.findAllForAccount(account);
          const hotelRequests = requestResult.data.filter((r: any) => Number(r.hotelId) === Number(args.hotelId));
          const { todayStart, todayEnd } = getTodayRange();
          const todayBookings = await bookingsRepository.findAll({ where: { hotelId: args.hotelId, [Op.or]: [{ startTime: { [Op.between]: [todayStart, todayEnd] } }, { endTime: { [Op.between]: [todayStart, todayEnd] } }] }, attributes: ['id', 'startTime', 'endTime'] });
          return JSON.stringify({ hotelName: hotelRecord.name, stats: [{ label: 'Pending Requests', value: hotelRequests.filter((r: any) => r.status === RequestStatus.PENDING).length, _card_type: 'stat' }, { label: 'High Priority', value: hotelRequests.filter((r: any) => r.urgency === RequestUrgency.HIGH && r.status !== RequestStatus.COMPLETED).length, _card_type: 'stat' }, { label: 'In Progress', value: hotelRequests.filter((r: any) => r.status === RequestStatus.IN_PROGRESS).length, _card_type: 'stat' }, { label: "Today's Check-ins", value: todayBookings.filter((b: any) => new Date(b.startTime) >= todayStart && new Date(b.startTime) < todayEnd).length, _card_type: 'stat' }, { label: "Today's Check-outs", value: todayBookings.filter((b: any) => new Date(b.endTime) >= todayStart && new Date(b.endTime) < todayEnd).length, _card_type: 'stat' }] });
        },
      }),
    });

    toolDefs.push({
      allowedRoles: { [AccountRole.HOTEL_STAFF]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'get_today_bookings',
        description: "Get bookings checking in or checking out today.",
        schema: z.object({ hotelId: z.number(), type: z.enum(['checkin', 'checkout', 'all']).optional() }),
        func: async (args) => {
          if (!await verifyHotelAccess(hotelsService, account, args.hotelId)) return JSON.stringify({ error: 'Hotel not found or no access' });
          const { todayStart, todayEnd } = getTodayRange();
          const where: any = { hotelId: args.hotelId };
          if (!args.type || args.type === 'all') where[Op.or] = [{ startTime: { [Op.between]: [todayStart, todayEnd] } }, { endTime: { [Op.between]: [todayStart, todayEnd] } }];
          else if (args.type === 'checkin'
          ) where.startTime = { [Op.between]: [todayStart, todayEnd] };
          else where.endTime = { [Op.between]: [todayStart, todayEnd] };
          const bookings = await bookingsRepository.findAll({ where, include: [{ model: Account, as: 'guest', attributes: ['id', 'name', 'email'] }], limit: 20 });
          const mapped: any[] = [];
          for (const b of bookings) { const bk: any = b; mapped.push({ id: bk.id, roomNumber: bk.roomNumber, startTime: bk.startTime, endTime: bk.endTime, guestName: bk.guest?.name ?? null, _card_type: 'booking' }); }
          return JSON.stringify(mapped);
        },
      }),
    });

    toolDefs.push({
      allowedRoles: { [AccountRole.HOTEL_STAFF]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'search_bookings',
        description: 'Search bookings by room number or guest name.',
        schema: z.object({ hotelId: z.number(), roomNumber: z.string().optional(), guestName: z.string().optional() }),
        func: async (args) => {
          if (!await verifyHotelAccess(hotelsService, account, args.hotelId)) return JSON.stringify({ error: 'Hotel not found or no access' });
          const where: any = { hotelId: args.hotelId };
          if (args.roomNumber) where.roomNumber = args.roomNumber;
          const guestInclude: any = { model: Account, as: 'guest', attributes: ['id', 'name', 'email'] };
          if (args.guestName) { guestInclude.where = { name: { [Op.iLike]: `%${args.guestName}%` } }; guestInclude.required = true; }
          const bookings = await bookingsRepository.findAll({ where, include: [guestInclude], limit: 10 });
          const mapped: any[] = [];
          for (const b of bookings) { const bk: any = b; mapped.push({ id: bk.id, roomNumber: bk.roomNumber, startTime: bk.startTime, endTime: bk.endTime, guestName: bk.guest?.name ?? null, _card_type: 'booking' }); }
          return JSON.stringify(mapped);
        },
      }),
    });

    toolDefs.push({
      allowedRoles: { [AccountRole.HOTEL_STAFF]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'get_request_detail',
        description: 'Get full details of a single request including all notes.',
        schema: z.object({ requestId: z.number() }),
        func: async (args) => {
          const result = await requestsService.findAllForAccount(account);
          const req = result.data.find((r: any) => r.id === args.requestId);
          if (!req) return JSON.stringify({ error: 'Request not found or no access' });
          const reqAny: any = req;
          return JSON.stringify({ id: reqAny.id, requestType: reqAny.requestType, status: reqAny.status, urgency: reqAny.urgency, userNotes: reqAny.userNotes ?? [], staffNotes: reqAny.staffNotes ?? [], guestName: reqAny.guest?.name ?? null, hotelName: reqAny.hotel?.name ?? null, roomNumber: reqAny.booking?.roomNumber ?? null, createdAt: reqAny.createdAt, _card_type: 'request' });
        },
      }),
    });

    toolDefs.push({
      allowedRoles: { [AccountRole.HOTEL_STAFF]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'create_booking',
        description: 'Create a new booking. Requires hotel ID, guest email, room number, start and end dates (YYYY-MM-DD). ALWAYS ask for room number before calling this — never omit it.',
        schema: z.object({ hotelId: z.number(), guestEmail: z.string(), roomNumber: z.string().describe('Room number — required, always ask before calling'), startDate: z.string(), endDate: z.string(), guestName: z.string().optional() }),
        func: async (args) => {
          const result = await bSvc.createBooking({ hotelId: args.hotelId, guestEmail: args.guestEmail, startDate: args.startDate, endDate: args.endDate, roomNumber: args.roomNumber, guestName: args.guestName, sendInviteImmediately: true }, account);
          const data: any = result.data;
          return JSON.stringify({ success: result.success, message: result.message, bookingId: data?.id, roomNumber: data?.roomNumber ?? null, hotelId: data?.hotelId ?? null, startTime: data?.startTime ?? null, endTime: data?.endTime ?? null });
        },
      }),
    });

    toolDefs.push({
      allowedRoles: { [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'update_hotel',
        description: 'Update hotel configuration: check-in/out times, address, phone, WiFi, facility hours.',
        schema: z.object({ hotelId: z.number(), checkInTime: z.string().optional(), checkOutTime: z.string().optional(), address: z.string().optional(), phoneNumber: z.string().optional(), wifiPassword: z.string().optional(), poolHours: z.string().optional(), gymHours: z.string().optional(), restaurantHours: z.string().optional(), breakfastHours: z.string().optional(), lunchHours: z.string().optional(), dinnerHours: z.string().optional() }),
        func: async (args) => {
          const { hotelId, ...updateDtoRaw } = args;
          const dto: any = updateDtoRaw;
          await hotelsService.updateHotel(hotelId, dto, account);
          return JSON.stringify({ success: true, message: 'Hotel updated' });
        },
      }),
    });

    toolDefs.push({
      allowedRoles: { [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'get_costs',
        description: 'Get AI usage cost summary grouped by guest name.',
        schema: z.object({}),
        func: async () => {
          const result = await costsService.aggregateCosts(account);
          const entries: any[] = Array.isArray(result.data) ? result.data : Object.values(result.data as object);
          const byGuest: Record<string, number> = {};
          for (const e of entries) {
            const name: string = e.guestName || 'Unknown';
            byGuest[name] = (byGuest[name] || 0) + (e.totalCost || 0);
          }
          const summary: any[] = [];
          for (const name of Object.keys(byGuest)) {
            summary.push({ guestName: name, totalCost: Number(byGuest[name].toFixed(6)) });
          }
          return JSON.stringify(summary);
        },
      }),
    });

    toolDefs.push({
      allowedRoles: { [AccountRole.GUEST]: true },
      tool: new DynamicStructuredTool({
        name: 'get_my_bookings',
        description: 'Get all bookings for the current guest. Each booking has isActive=true if the stay is currently ongoing.',
        schema: z.object({}),
        func: async () => {
          const bookings = await bookingsRepository.findAll({ where: { guestId: account.id }, include: [{ model: Hotel, as: 'hotel', attributes: ['id', 'name', 'address'] }], order: [['startTime', 'DESC']], limit: 5 });
          const now = new Date();
          const mapped: any[] = [];
          for (const b of bookings) {
            const bk: any = b;
            const isActive = bk.startTime && bk.endTime && now >= new Date(bk.startTime) && now <= new Date(bk.endTime);
            mapped.push({ id: bk.id, roomNumber: bk.roomNumber, startTime: bk.startTime, endTime: bk.endTime, hotelName: bk.hotel?.name ?? null, hotelId: bk.hotelId, isActive: !!isActive, _card_type: 'booking' });
          }
          return JSON.stringify(mapped);
        },
      }),
    });

    toolDefs.push({
      allowedRoles: { [AccountRole.GUEST]: true },
      tool: new DynamicStructuredTool({
        name: 'create_guest_request',
        description: 'Create a service request for a specific guest booking. Call get_my_bookings first to find booking IDs and room numbers. If guest has multiple bookings, ask which room number before calling this.',
        schema: z.object({
          bookingId: z.number().describe('Booking ID from get_my_bookings'),
          requestType: z.nativeEnum(RequestType),
          urgency: z.nativeEnum(RequestUrgency),
          userNotes: z.array(z.string()).optional(),
        }),
        func: async (args) => {
          const booking = await bookingsRepository.findOne({ where: { id: args.bookingId, guestId: account.id } });
          if (!booking) return JSON.stringify({ error: 'Booking not found or does not belong to you' });
          const nowIso = new Date().toISOString();
          const userNotes: { text: string; addedAt: string }[] = [];
          for (const text of (args.userNotes ?? [])) userNotes.push({ text, addedAt: nowIso });
          const result = await requestsService.create({ hotelId: (booking as any).hotelId, guestId: account.id, bookingId: args.bookingId, requestType: args.requestType, urgency: args.urgency, userNotes }, account);
          return JSON.stringify(result);
        },
      }),
    });

    toolDefs.push({
      allowedRoles: { [AccountRole.GUEST]: true },
      tool: new DynamicStructuredTool({
        name: 'get_hotel_info',
        description: 'Get hotel information (check-in/out times, WiFi, pool hours, amenities) for one of the guest bookings.',
        schema: z.object({ hotelId: z.number() }),
        func: async (args) => {
          const hotelRaw = await hotelsService.findById(args.hotelId);
          if (!hotelRaw) return JSON.stringify({ error: 'Hotel not found' });
          const h: any = hotelRaw;
          return JSON.stringify({ name: h.name, address: h.address, checkInTime: h.checkInTime, checkOutTime: h.checkOutTime, wifiPassword: h.wifiPassword, poolHours: h.poolHours, gymHours: h.gymHours, restaurantHours: h.restaurantHours, breakfastHours: h.breakfastHours, lunchHours: h.lunchHours, dinnerHours: h.dinnerHours });
        },
      }),
    });
  }

  const allowed: DynamicStructuredTool[] = [];
  for (const { allowedRoles, tool } of toolDefs) {
    if (allowedRoles[account.role]) allowed.push(tool);
  }
  return allowed;
}
