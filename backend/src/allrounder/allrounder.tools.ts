import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { AllRounderToolContext } from './allrounder-tool.context';
import { HotelsService } from '../hotels/hotels.service';
import { RequestsService } from '../requests/requests.service';
import { BookingsService } from '../bookings/bookings.service';
import { CostsService } from '../costs/costs.service';
import { Booking } from '../bookings/bookings.model';
import { Account } from '../accounts/accounts.model';
import { Hotel } from '../hotels/hotels.model';
import { RequestStatus, RequestUrgency, RequestType } from '../requests/requests.model';
import { AccountRole } from '../common/constants/constants.service';
import { Op } from 'sequelize';

export interface AllRounderToolDeps {
  hotelsService: HotelsService;
  requestsService: RequestsService;
  bookingsService: BookingsService;
  costsService: CostsService;
  bookingsRepository: typeof Booking;
}

export function createAllRounderTools(ctx: AllRounderToolContext, deps: AllRounderToolDeps): DynamicStructuredTool[] {
  const { account } = ctx;

  type ToolDef = { allowedRoles: Partial<Record<AccountRole, boolean>>; tool: DynamicStructuredTool };

  const toolDefs: ToolDef[] = [
    {
      allowedRoles: { [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'list_my_hotels',
        description: 'List all hotels this account has access to. Use when asked about hotels or hotel overview.',
        schema: z.object({}),
        func: async () => {
          const result = await deps.hotelsService.findAllForAccount(account);
          const hotels: any[] = [];
          for (const h of result.data) {
            hotels.push({ id: h.id, name: h.name, address: h.address ?? null, _card_type: 'hotel' });
          }
          return JSON.stringify(hotels);
        },
      }),
    },
    {
      allowedRoles: { [AccountRole.HOTEL_STAFF]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'list_requests',
        description:
          'Search and list service requests. Use this FIRST whenever user mentions a request by guest name, room number, or request type — before asking for any ID. Returns request cards the user can confirm.',
        schema: z.object({
          hotelId: z.number().optional().describe('Filter by hotel ID (use exact ID from hotel list)'),
          status: z.nativeEnum(RequestStatus).optional().describe('Filter by status'),
          urgency: z.nativeEnum(RequestUrgency).optional().describe('Filter by urgency'),
          requestType: z.nativeEnum(RequestType).optional().describe('Filter by request type (room_service, house_keeping, laundry, airport_transfer)'),
          guestName: z.string().optional().describe('Filter by guest name (partial, case-insensitive)'),
          roomNumber: z.string().optional().describe('Filter by room number'),
          limit: z.number().optional().describe('Max results, default 10'),
        }),
        func: async (args) => {
          const result = await deps.requestsService.findAllForAccount(account);
          let requests: any[] = result.data;
          if (args.hotelId) requests = requests.filter((r: any) => Number(r.hotelId) === Number(args.hotelId));
          if (args.status) requests = requests.filter((r: any) => r.status === args.status);
          if (args.urgency) requests = requests.filter((r: any) => r.urgency === args.urgency);
          if (args.requestType) requests = requests.filter((r: any) => r.requestType === args.requestType);
          if (args.guestName) {
            const q = args.guestName.toLowerCase();
            requests = requests.filter((r: any) => r.guest?.name?.toLowerCase().includes(q));
          }
          if (args.roomNumber) {
            requests = requests.filter((r: any) => r.booking?.roomNumber === args.roomNumber || String(r.booking?.roomNumber) === String(args.roomNumber));
          }
          requests = requests.slice(0, args.limit ?? 10);
          const mapped: any[] = [];
          for (const r of requests) {
            mapped.push({ id: r.id, requestType: r.requestType, status: r.status, urgency: r.urgency, guestName: r.guest?.name ?? null, hotelName: r.hotel?.name ?? null, roomNumber: r.booking?.roomNumber ?? null, bookingId: r.bookingId, createdAt: r.createdAt, _card_type: 'request' });
          }
          return JSON.stringify(mapped);
        },
      }),
    },
    {
      allowedRoles: { [AccountRole.HOTEL_STAFF]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'get_hotel_stats',
        description: 'Get stats for a hotel: pending request count, high priority count, in-progress count, and today check-ins/check-outs.',
        schema: z.object({
          hotelId: z.number().describe('Hotel ID to get stats for'),
        }),
        func: async (args) => {
          const allHotels = await deps.hotelsService.findAllForAccount(account);
          const hotel = allHotels.data.find((h: any) => h.id === args.hotelId);
          if (!hotel) return JSON.stringify({ error: 'Hotel not found or no access' });

          const requestResult = await deps.requestsService.findAllForAccount(account);
          const hotelRequests = requestResult.data.filter((r: any) => Number(r.hotelId) === Number(args.hotelId));
          const pending = hotelRequests.filter((r: any) => r.status === RequestStatus.PENDING).length;
          const highPriority = hotelRequests.filter((r: any) => r.urgency === RequestUrgency.HIGH && r.status !== RequestStatus.COMPLETED).length;
          const inProgress = hotelRequests.filter((r: any) => r.status === RequestStatus.IN_PROGRESS).length;

          const today = new Date();
          const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

          const todayBookings = await deps.bookingsRepository.findAll({
            where: {
              hotelId: args.hotelId,
              [Op.or]: [{ startTime: { [Op.between]: [todayStart, todayEnd] } }, { endTime: { [Op.between]: [todayStart, todayEnd] } }],
            },
            attributes: ['id', 'startTime', 'endTime'],
          });

          const checkIns = todayBookings.filter((b: any) => {
            const start = new Date(b.startTime);
            return start >= todayStart && start < todayEnd;
          }).length;

          const checkOuts = todayBookings.filter((b: any) => {
            const end = new Date(b.endTime);
            return end >= todayStart && end < todayEnd;
          }).length;

          return JSON.stringify({
            hotelName: hotel.name,
            stats: [
              { label: 'Pending Requests', value: pending, _card_type: 'stat' },
              { label: 'High Priority', value: highPriority, _card_type: 'stat' },
              { label: 'In Progress', value: inProgress, _card_type: 'stat' },
              { label: "Today's Check-ins", value: checkIns, _card_type: 'stat' },
              { label: "Today's Check-outs", value: checkOuts, _card_type: 'stat' },
            ],
          });
        },
      }),
    },
    {
      allowedRoles: { [AccountRole.HOTEL_STAFF]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'get_today_bookings',
        description: "Get bookings checking in or out today for a hotel. Use 'checkin', 'checkout', or 'all'.",
        schema: z.object({
          hotelId: z.number().describe('Hotel ID'),
          type: z.enum(['checkin', 'checkout', 'all']).optional().describe("Filter: 'checkin', 'checkout', or 'all'. Default: all"),
        }),
        func: async (args) => {
          const allHotels = await deps.hotelsService.findAllForAccount(account);
          const hotel = allHotels.data.find((h: any) => h.id === args.hotelId);
          if (!hotel) return JSON.stringify({ error: 'Hotel not found or no access' });

          const today = new Date();
          const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

          const where: any = { hotelId: args.hotelId };
          if (!args.type || args.type === 'all') {
            where[Op.or] = [{ startTime: { [Op.between]: [todayStart, todayEnd] } }, { endTime: { [Op.between]: [todayStart, todayEnd] } }];
          } else if (args.type === 'checkin') {
            where.startTime = { [Op.between]: [todayStart, todayEnd] };
          } else {
            where.endTime = { [Op.between]: [todayStart, todayEnd] };
          }

          const bookings = await deps.bookingsRepository.findAll({
            where,
            include: [{ model: Account, as: 'guest', attributes: ['id', 'name', 'email'] }],
            limit: 20,
          });

          const todayMapped: any[] = [];
          for (const b of bookings) {
            todayMapped.push({ id: b.id, roomNumber: b.roomNumber, startTime: b.startTime, endTime: b.endTime, guestName: (b as any).guest?.name ?? null, guestEmail: (b as any).guest?.email ?? null, _card_type: 'booking' });
          }
          return JSON.stringify(todayMapped);
        },
      }),
    },
    {
      allowedRoles: { [AccountRole.HOTEL_STAFF]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'search_bookings',
        description: 'Search bookings for a hotel by room number or guest name. Returns booking cards.',
        schema: z.object({
          hotelId: z.number().describe('Hotel ID'),
          roomNumber: z.string().optional().describe('Room number to search for'),
          guestName: z.string().optional().describe('Guest name (partial match)'),
        }),
        func: async (args) => {
          const allHotels = await deps.hotelsService.findAllForAccount(account);
          const hotel = allHotels.data.find((h: any) => h.id === args.hotelId);
          if (!hotel) return JSON.stringify({ error: 'Hotel not found or no access' });

          const where: any = { hotelId: args.hotelId };
          if (args.roomNumber) where.roomNumber = args.roomNumber;

          const guestInclude: any = { model: Account, as: 'guest', attributes: ['id', 'name', 'email'] };
          if (args.guestName) {
            guestInclude.where = { name: { [Op.iLike]: `%${args.guestName}%` } };
            guestInclude.required = true;
          }

          const bookings = await deps.bookingsRepository.findAll({
            where,
            include: [guestInclude],
            limit: 10,
          });

          const searchMapped: any[] = [];
          for (const b of bookings) {
            searchMapped.push({ id: b.id, roomNumber: b.roomNumber, startTime: b.startTime, endTime: b.endTime, guestName: (b as any).guest?.name ?? null, guestEmail: (b as any).guest?.email ?? null, _card_type: 'booking' });
          }
          return JSON.stringify(searchMapped);
        },
      }),
    },
    {
      allowedRoles: { [AccountRole.HOTEL_STAFF]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'update_request',
        description: 'Update a request status or urgency. Optionally add a staff note.',
        schema: z.object({
          requestId: z.number().describe('Request ID to update'),
          status: z.nativeEnum(RequestStatus).optional(),
          urgency: z.nativeEnum(RequestUrgency).optional(),
          staffNote: z.string().optional().describe('Optional staff note to append'),
        }),
        func: async (args) => {
          const { requestId, staffNote, ...updateDto } = args;
          const updateResult = await deps.requestsService.update(requestId, updateDto, account);
          if (staffNote) {
            await deps.requestsService.appendStaffMessage(requestId, staffNote, account);
          }
          return JSON.stringify(updateResult);
        },
      }),
    },
    {
      allowedRoles: { [AccountRole.GUEST]: true },
      tool: new DynamicStructuredTool({
        name: 'get_my_bookings',
        description: 'Get all bookings for the current guest. Use to answer questions about their stays.',
        schema: z.object({}),
        func: async () => {
          const bookings = await deps.bookingsRepository.findAll({
            where: { guestId: account.id },
            include: [{ model: Hotel, as: 'hotel', attributes: ['id', 'name', 'address'] }],
            order: [['startTime', 'DESC']],
            limit: 5,
          });
          const guestBookings: any[] = [];
          for (const b of bookings) {
            guestBookings.push({ id: b.id, roomNumber: b.roomNumber, startTime: b.startTime, endTime: b.endTime, hotelName: (b as any).hotel?.name ?? null, hotelId: b.hotelId, _card_type: 'booking' });
          }
          return JSON.stringify(guestBookings);
        },
      }),
    },
    {
      allowedRoles: { [AccountRole.GUEST]: true },
      tool: new DynamicStructuredTool({
        name: 'create_request',
        description: 'Create a service request for a guest booking. First use get_my_bookings to find the booking ID if not known.',
        schema: z.object({
          bookingId: z.number().describe('Booking ID to create the request for'),
          requestType: z.nativeEnum(RequestType),
          urgency: z.nativeEnum(RequestUrgency),
          userNotes: z.array(z.string()).optional(),
        }),
        func: async (args) => {
          const booking = await deps.bookingsRepository.findOne({
            where: { id: args.bookingId, guestId: account.id },
          });
          if (!booking) return JSON.stringify({ error: 'Booking not found or does not belong to you' });

          const nowIso = new Date().toISOString();
          const userNotes = (args.userNotes ?? []).map((text) => ({ text, addedAt: nowIso }));
          const result = await deps.requestsService.create(
            {
              hotelId: (booking as any).hotelId,
              guestId: account.id,
              bookingId: args.bookingId,
              requestType: args.requestType,
              urgency: args.urgency,
              userNotes,
            },
            account,
          );
          return JSON.stringify(result);
        },
      }),
    },
    {
      allowedRoles: { [AccountRole.HOTEL_STAFF]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'create_booking',
        description: 'Create a new booking for a guest. Requires hotel ID, guest email, start and end dates (YYYY-MM-DD).',
        schema: z.object({
          hotelId: z.number().describe('Hotel ID'),
          guestEmail: z.string().describe('Guest email address'),
          startDate: z.string().describe('Check-in date YYYY-MM-DD'),
          endDate: z.string().describe('Check-out date YYYY-MM-DD'),
          roomNumber: z.string().optional().describe('Room number'),
          guestName: z.string().optional().describe('Guest full name'),
        }),
        func: async (args) => {
          const result = await deps.bookingsService.createBooking(
            {
              hotelId: args.hotelId,
              guestEmail: args.guestEmail,
              startDate: args.startDate,
              endDate: args.endDate,
              roomNumber: args.roomNumber,
              guestName: args.guestName,
              sendInviteImmediately: true,
            },
            account,
          );
          return JSON.stringify({ success: result.success, message: result.message, bookingId: (result.data as any)?.id });
        },
      }),
    },
    {
      allowedRoles: { [AccountRole.HOTEL_STAFF]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'get_request_detail',
        description: 'Get full details of a single request including all notes and history.',
        schema: z.object({
          requestId: z.number().describe('Request ID'),
        }),
        func: async (args) => {
          const result = await deps.requestsService.findAllForAccount(account);
          const req = result.data.find((r: any) => r.id === args.requestId);
          if (!req) return JSON.stringify({ error: 'Request not found or no access' });
          return JSON.stringify({
            id: req.id,
            requestType: req.requestType,
            status: req.status,
            urgency: req.urgency,
            userNotes: req.userNotes ?? [],
            staffNotes: req.staffNotes ?? [],
            guestName: (req as any).guest?.name ?? null,
            guestEmail: (req as any).guest?.email ?? null,
            hotelName: (req as any).hotel?.name ?? null,
            roomNumber: (req as any).booking?.roomNumber ?? null,
            bookingId: req.bookingId,
            createdAt: req.createdAt,
            updatedAt: req.updatedAt,
            _card_type: 'request',
          });
        },
      }),
    },
    {
      allowedRoles: { [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'update_hotel',
        description: 'Update hotel configuration: check-in/check-out times, address, phone, WiFi password, facility hours.',
        schema: z.object({
          hotelId: z.number().describe('Hotel ID to update'),
          checkInTime: z.string().optional().describe('Check-in time HH:MM'),
          checkOutTime: z.string().optional().describe('Check-out time HH:MM'),
          address: z.string().optional(),
          phoneNumber: z.string().optional(),
          wifiPassword: z.string().optional(),
          poolHours: z.string().optional(),
          gymHours: z.string().optional(),
          restaurantHours: z.string().optional(),
          breakfastHours: z.string().optional(),
          lunchHours: z.string().optional(),
          dinnerHours: z.string().optional(),
        }),
        func: async (args) => {
          const { hotelId, ...updateDto } = args;
          const result = await deps.hotelsService.updateHotel(hotelId, updateDto as any, account);
          return JSON.stringify({ success: true, message: 'Hotel updated', hotelId: (result as any)?.id ?? hotelId });
        },
      }),
    },
    {
      allowedRoles: { [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'get_costs',
        description: 'Get AI usage cost summary. Returns aggregated costs across hotels and booking types.',
        schema: z.object({}),
        func: async () => {
          const result = await deps.costsService.aggregateCosts(account);
          return JSON.stringify(result.data);
        },
      }),
    },
  ];

  return toolDefs.filter(({ allowedRoles }) => !!allowedRoles[account.role]).map(({ tool }) => tool);
}
