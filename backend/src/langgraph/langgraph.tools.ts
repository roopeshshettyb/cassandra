import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { AgentToolContext } from './langgraph-tools.context';
import { BookingsService } from '../bookings/bookings.service';
import { RequestsService } from '../requests/requests.service';
import { RestaurantService } from '../restaurant/restaurant.service';
import { HotelsService } from '../hotels/hotels.service';
import { ChatService } from '../chat/chat.service';
import { ConstantsService } from '../common/constants/constants.service';
import { RequestType, RequestUrgency, RequestStatus } from '../requests/requests.model';
import { AccountRole } from '../common/constants/constants.service';
import { CreateRequestDto } from '../requests/requests.dto';

export function createAgentTools(
  ctx: AgentToolContext,
  bookingsService: BookingsService,
  requestsService: RequestsService,
  restaurantService: RestaurantService,
  chatService: ChatService,
  hotelsService: HotelsService,
  constantsService: ConstantsService,
): DynamicStructuredTool[] {
  const { account, chatId, languageCode } = ctx;
  let currentBookingId: number | null = ctx.bookingId;
  let currentHotel: Record<string, unknown> | null = ctx.hotel;
  let currentBooking: Record<string, unknown> | null = ctx.booking;

  const getMissingBookingContextPayload = () =>
    JSON.stringify({
      success: false,
      message: 'Booking context missing',
      data: null,
    });

  const isStaffOrOwnerOrAdmin =
    account.role === AccountRole.ADMIN ||
    account.role === AccountRole.HOTEL_OWNER ||
    account.role === AccountRole.HOTEL_STAFF;

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
        if (!currentBookingId || !currentBooking) {
          return getMissingBookingContextPayload();
        }
        const bookingAny: any = currentBooking;
        const hotelId = bookingAny?.hotelId;
        const guestId = bookingAny?.guestId;
        const nowIso = new Date().toISOString();
        const userNotes = (args.userNotes ?? []).map((text) => ({ text, addedAt: nowIso }));

        const dto: CreateRequestDto = {
          hotelId,
          guestId,
          bookingId: currentBookingId,
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
        name: 'get_requests',
        description:
          'Get service requests with optional filters and sorting. Defaults to pending status. When booking context is set, returns requests for that booking. Hotel staff, owners, and admins can also query hotel-wide requests without booking context (optionally filter by hotelId). Guests require booking context.',
        schema: z.object({
          status: z.nativeEnum(RequestStatus).optional().describe('Filter by status; defaults to pending'),
          requestType: z.nativeEnum(RequestType).optional().describe('Filter by request type'),
          urgency: z.nativeEnum(RequestUrgency).optional().describe('Filter by urgency'),
          hotelId: z.number().optional().describe('Filter by hotel id (staff/owner/admin without booking context)'),
          sortBy: z.enum(['createdAt', 'updatedAt', 'urgency']).optional().describe('Sort field; defaults to createdAt'),
          sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort direction; defaults to desc'),
          limit: z.number().optional().describe('Max results to return'),
        }),
        func: async (args) => {
          const agentLimits = constantsService.private;
          const queryOptions = {
            status: args.status ?? RequestStatus.PENDING,
            requestType: args.requestType,
            urgency: args.urgency,
            hotelId: args.hotelId,
            sortBy: args.sortBy,
            sortOrder: args.sortOrder,
            limit: args.limit ?? agentLimits.AGENT_REQUESTS_DEFAULT_LIMIT,
          };

          if (account.role === AccountRole.GUEST) {
            if (!currentBookingId) {
              return getMissingBookingContextPayload();
            }
            const result = await requestsService.findForAccountWithOptions(account, {
              ...queryOptions,
              bookingId: currentBookingId,
            });
            return JSON.stringify(result);
          }

          if (currentBookingId) {
            const result = await requestsService.findForAccountWithOptions(account, {
              ...queryOptions,
              bookingId: currentBookingId,
            });
            return JSON.stringify(result);
          }

          if (isStaffOrOwnerOrAdmin) {
            const result = await requestsService.findForAccountWithOptions(account, queryOptions);
            return JSON.stringify(result);
          }

          return getMissingBookingContextPayload();
        },
      }),
    },
    {
      allowedRoles: { [AccountRole.GUEST]: true, [AccountRole.HOTEL_STAFF]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'get_recent_bookings',
        description:
          'Get bookings available to the current account with optional filters and sorting. Defaults to active stays only. Use when booking context is not set and you need to identify the booking from conversation. If you get multiple bookings, ask the user to confirm which one they mean.',
        schema: z.object({
          activeOnly: z.boolean().optional().describe('When true, only returns bookings where the stay is currently active'),
          hotelId: z.number().optional().describe('Filter by hotel id'),
          roomNumber: z.string().optional().describe('Filter by room number (partial match)'),
          guestKeywords: z.string().optional().describe('Filter by guest name or email (partial match)'),
          startAfter: z.string().optional().describe('ISO date — only bookings starting on or after this date'),
          startBefore: z.string().optional().describe('ISO date — only bookings starting on or before this date'),
          sortBy: z.enum(['startTime', 'endTime', 'id']).optional().describe('Sort field; defaults to startTime'),
          sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort direction; defaults to desc'),
          limit: z.number().optional().describe('Max results to return'),
        }),
        func: async (args) => {
          const agentLimits = constantsService.private;
          const result = await bookingsService.findForAccountWithOptions(account, {
            activeOnly: args.activeOnly ?? agentLimits.AGENT_BOOKINGS_ACTIVE_ONLY_DEFAULT,
            hotelId: args.hotelId,
            roomNumber: args.roomNumber,
            guestKeywords: args.guestKeywords,
            startAfter: args.startAfter,
            startBefore: args.startBefore,
            sortBy: args.sortBy,
            sortOrder: args.sortOrder,
            limit: args.limit ?? agentLimits.AGENT_BOOKINGS_DEFAULT_LIMIT,
          });
          return JSON.stringify(result);
        },
      }),
    },
    {
      allowedRoles: { [AccountRole.GUEST]: true, [AccountRole.HOTEL_STAFF]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'set_booking_context',
        description:
          'Set booking context for this chat using a booking id that belongs to the current account. Use this after identifying which booking the user means.',
        schema: z.object({
          bookingId: z.number().describe('The booking id to set as current context for this chat'),
        }),
        func: async (args) => {
          const bookingResult = await bookingsService.findByIdForAccount(args.bookingId, account);
          const bookingData: any = bookingResult?.data ?? null;
          await chatService.setBookingForChat(chatId, args.bookingId, account);
          currentBookingId = args.bookingId;
          currentBooking = bookingData;
          currentHotel = bookingData?.hotel ?? null;
          ctx.bookingId = currentBookingId;
          ctx.booking = currentBooking;
          ctx.hotel = currentHotel;
          return JSON.stringify({
            success: true,
            message: 'Booking context updated',
            data: {
              bookingId: currentBookingId,
              booking: currentBooking,
            },
          });
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
      allowedRoles: { [AccountRole.GUEST]: true, [AccountRole.HOTEL_STAFF]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.ADMIN]: true },
      tool: new DynamicStructuredTool({
        name: 'get_hotels',
        description:
          'List hotels accessible to the current account. For guests, returns hotels from their bookings. For staff and owners, returns linked properties. Use before set_booking_context or when answering multi-property questions.',
        schema: z.object({
          keywords: z.string().optional().describe('Search by hotel name or address (partial match)'),
          sortBy: z.enum(['name', 'id']).optional().describe('Sort field; defaults to name'),
          sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort direction; defaults to asc'),
          limit: z.number().optional().describe('Max results to return'),
        }),
        func: async (args) => {
          const agentLimits = constantsService.private;
          const result = await hotelsService.findAllForAccount(account, {
            keywords: args.keywords,
            sortBy: args.sortBy,
            sortOrder: args.sortOrder,
            limit: args.limit ?? agentLimits.AGENT_HOTELS_DEFAULT_LIMIT,
          });
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
        return JSON.stringify(currentBooking ?? { error: 'Booking context missing' });
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
        return JSON.stringify(currentHotel);
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
        const bookingAny: any = currentBooking;
        const hotelId = bookingAny?.hotelId;
        if (!hotelId) {
          return JSON.stringify({ error: 'Booking context missing' });
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

  return toolDefs.filter(({ allowedRoles }) => !!allowedRoles[account.role]).map(({ tool }) => tool);
}
