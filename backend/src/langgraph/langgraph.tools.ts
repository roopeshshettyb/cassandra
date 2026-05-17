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
        const userNotes = (args.userNotes ?? []).map((text) => ({ text, addedAt: nowIso }));

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
          for (const h of result.data) hotels.push({ id: h.id, name: h.name, address: (h as any).address ?? null, _card_type: 'hotel' });
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
        description: 'Get pending/high-priority/in-progress request counts and today check-ins/check-outs for a hotel.',
        schema: z.object({ hotelId: z.number() }),
        func: async (args) => {
          const allHotels = await hotelsService.findAllForAccount(account);
          const hotel = allHotels.data.find((h: any) => h.id === args.hotelId);
          if (!hotel) return JSON.stringify({ error: 'Hotel not found or no access' });
          const requestResult = await requestsService.findAllForAccount(account);
          const hotelRequests = requestResult.data.filter((r: any) => Number(r.hotelId) === Number(args.hotelId));
          const today = new Date(); const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()); const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
          const todayBookings = await bookingsRepository.findAll({ where: { hotelId: args.hotelId, [Op.or]: [{ startTime: { [Op.between]: [todayStart, todayEnd] } }, { endTime: { [Op.between]: [todayStart, todayEnd] } }] }, attributes: ['id', 'startTime', 'endTime'] });
          return JSON.stringify({ hotelName: (hotel as any).name, stats: [{ label: 'Pending Requests', value: hotelRequests.filter((r: any) => r.status === RequestStatus.PENDING).length, _card_type: 'stat' }, { label: 'High Priority', value: hotelRequests.filter((r: any) => r.urgency === RequestUrgency.HIGH && r.status !== RequestStatus.COMPLETED).length, _card_type: 'stat' }, { label: 'In Progress', value: hotelRequests.filter((r: any) => r.status === RequestStatus.IN_PROGRESS).length, _card_type: 'stat' }, { label: "Today's Check-ins", value: todayBookings.filter((b: any) => new Date(b.startTime) >= todayStart && new Date(b.startTime) < todayEnd).length, _card_type: 'stat' }, { label: "Today's Check-outs", value: todayBookings.filter((b: any) => new Date(b.endTime) >= todayStart && new Date(b.endTime) < todayEnd).length, _card_type: 'stat' }] });
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
          const allHotels = await hotelsService.findAllForAccount(account);
          if (!allHotels.data.find((h: any) => h.id === args.hotelId)) return JSON.stringify({ error: 'Hotel not found or no access' });
          const today = new Date(); const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()); const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
          const where: any = { hotelId: args.hotelId };
          if (!args.type || args.type === 'all') where[Op.or] = [{ startTime: { [Op.between]: [todayStart, todayEnd] } }, { endTime: { [Op.between]: [todayStart, todayEnd] } }];
          else if (args.type === 'checkin'
          ) where.startTime = { [Op.between]: [todayStart, todayEnd] };
          else where.endTime = { [Op.between]: [todayStart, todayEnd] };
          const bookings = await bookingsRepository.findAll({ where, include: [{ model: Account, as: 'guest', attributes: ['id', 'name', 'email'] }], limit: 20 });
          const mapped: any[] = [];
          for (const b of bookings) mapped.push({ id: b.id, roomNumber: b.roomNumber, startTime: b.startTime, endTime: b.endTime, guestName: (b as any).guest?.name ?? null, _card_type: 'booking' });
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
          const allHotels = await hotelsService.findAllForAccount(account);
          if (!allHotels.data.find((h: any) => h.id === args.hotelId)) return JSON.stringify({ error: 'Hotel not found or no access' });
          const where: any = { hotelId: args.hotelId };
          if (args.roomNumber) where.roomNumber = args.roomNumber;
          const guestInclude: any = { model: Account, as: 'guest', attributes: ['id', 'name', 'email'] };
          if (args.guestName) { guestInclude.where = { name: { [Op.iLike]: `%${args.guestName}%` } }; guestInclude.required = true; }
          const bookings = await bookingsRepository.findAll({ where, include: [guestInclude], limit: 10 });
          const mapped: any[] = [];
          for (const b of bookings) mapped.push({ id: b.id, roomNumber: b.roomNumber, startTime: b.startTime, endTime: b.endTime, guestName: (b as any).guest?.name ?? null, _card_type: 'booking' });
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
          return JSON.stringify({ id: req.id, requestType: req.requestType, status: req.status, urgency: req.urgency, userNotes: req.userNotes ?? [], staffNotes: req.staffNotes ?? [], guestName: (req as any).guest?.name ?? null, hotelName: (req as any).hotel?.name ?? null, roomNumber: (req as any).booking?.roomNumber ?? null, createdAt: req.createdAt, _card_type: 'request' });
        },
      }),
    });

    toolDefs.push({
      allowedRoles: { [AccountRole.HOTEL_STAFF]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'create_booking',
        description: 'Create a new booking. Requires hotel ID, guest email, start and end dates (YYYY-MM-DD).',
        schema: z.object({ hotelId: z.number(), guestEmail: z.string(), startDate: z.string(), endDate: z.string(), roomNumber: z.string().optional(), guestName: z.string().optional() }),
        func: async (args) => {
          const result = await bSvc.createBooking({ hotelId: args.hotelId, guestEmail: args.guestEmail, startDate: args.startDate, endDate: args.endDate, roomNumber: args.roomNumber, guestName: args.guestName, sendInviteImmediately: true }, account);
          return JSON.stringify({ success: result.success, message: result.message, bookingId: (result.data as any)?.id });
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
          const { hotelId, ...updateDto } = args;
          await hotelsService.updateHotel(hotelId, updateDto as any, account);
          return JSON.stringify({ success: true, message: 'Hotel updated' });
        },
      }),
    });

    toolDefs.push({
      allowedRoles: { [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'get_costs',
        description: 'Get AI usage cost summary.',
        schema: z.object({}),
        func: async () => {
          const result = await costsService.aggregateCosts(account);
          return JSON.stringify(result.data);
        },
      }),
    });

    toolDefs.push({
      allowedRoles: { [AccountRole.GUEST]: true },
      tool: new DynamicStructuredTool({
        name: 'get_my_bookings',
        description: 'Get all bookings for the current guest.',
        schema: z.object({}),
        func: async () => {
          const bookings = await bookingsRepository.findAll({ where: { guestId: account.id }, include: [{ model: Hotel, as: 'hotel', attributes: ['id', 'name', 'address'] }], order: [['startTime', 'DESC']], limit: 5 });
          const mapped: any[] = [];
          for (const b of bookings) mapped.push({ id: b.id, roomNumber: b.roomNumber, startTime: b.startTime, endTime: b.endTime, hotelName: (b as any).hotel?.name ?? null, hotelId: b.hotelId, _card_type: 'booking' });
          return JSON.stringify(mapped);
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
          const hotel = await hotelsService.findById(args.hotelId);
          if (!hotel) return JSON.stringify({ error: 'Hotel not found' });
          return JSON.stringify({ name: (hotel as any).name, address: (hotel as any).address, checkInTime: (hotel as any).checkInTime, checkOutTime: (hotel as any).checkOutTime, wifiPassword: (hotel as any).wifiPassword, poolHours: (hotel as any).poolHours, gymHours: (hotel as any).gymHours, restaurantHours: (hotel as any).restaurantHours, breakfastHours: (hotel as any).breakfastHours, lunchHours: (hotel as any).lunchHours, dinnerHours: (hotel as any).dinnerHours });
        },
      }),
    });
  }

  return toolDefs.filter(({ allowedRoles }) => !!allowedRoles[account.role]).map(({ tool }) => tool);
}
