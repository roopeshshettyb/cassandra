import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { AgentToolContext } from './langgraph-tools.context';
import { BookingsService } from '../bookings/bookings.service';
import { RequestsService } from '../requests/requests.service';
import { RestaurantService } from '../restaurant/restaurant.service';
import { ChatService } from '../chat/chat.service';
import { RequestType, RequestUrgency, RequestStatus } from '../requests/requests.model';
import { CreateRequestDto } from '../requests/requests.dto';

export function createAgentTools(
  ctx: AgentToolContext,
  bookingsService: BookingsService,
  requestsService: RequestsService,
  restaurantService: RestaurantService,
  chatService: ChatService,
): DynamicStructuredTool[] {
  const { account, bookingId, chatId, hotel, booking, languageCode } = ctx;

  return [
    new DynamicStructuredTool({
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
        const bookingAny: any = booking;
        const hotelId = bookingAny?.hotelId;
        const guestId = bookingAny?.guestId;
        const userNotes: { text: string; addedAt: string }[] = [];
        const rawUserNotes: string[] = args.userNotes ?? [];
        const nowIso = new Date().toISOString();
        for (let i = 0; i < rawUserNotes.length; i += 1) {
          userNotes.push({ text: rawUserNotes[i], addedAt: nowIso });
        }

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
    new DynamicStructuredTool({
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
    new DynamicStructuredTool({
      name: 'get_pending_requests',
      description: 'Get all pending requests for the current booking (status is pending). Use this to summarize or act on outstanding requests.',
      schema: z.object({}),
      func: async () => {
        const pending = await requestsService.findByBookingId(bookingId, account, RequestStatus.PENDING);
        return JSON.stringify(pending);
      },
    }),
    new DynamicStructuredTool({
      name: 'append_message',
      description: 'Append a message to an existing request. If the current speaker is a guest, it will be added as a user note; if hotel owner/staff, it will be added as a staff note.',
      schema: z.object({
        requestId: z.number().describe('The id of the request to update'),
        message: z.string().describe('The message to append as a note'),
      }),
      func: async (args) => {
        // Route to the appropriate append method based on the current account role.
        if (account.role === 'guest') {
          const result = await requestsService.appendUserMessage(args.requestId, args.message, account);
          return JSON.stringify(result);
        }

        // Admins, hotel owners, and hotel staff should write staff notes.
        const result = await requestsService.appendStaffMessage(args.requestId, args.message, account);
        return JSON.stringify(result);
      },
    }),
    new DynamicStructuredTool({
      name: 'get_booking',
      description: 'Get the current booking details (dates, hotel, etc.). Use this to answer guest questions about this booking.',
      schema: z.object({}),
      func: async () => {
        return JSON.stringify(booking ?? { error: 'No booking in context' });
      },
    }),
    new DynamicStructuredTool({
      name: 'get_hotel',
      description:
        'Get the hotel information for the current booking (name, address, check-in/out times, amenities hours, wifi, etc.). Use this to answer guest questions about the hotel associated with this booking.',
      schema: z.object({}),
      func: async () => {
        return JSON.stringify(hotel);
      },
    }),
    new DynamicStructuredTool({
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
    new DynamicStructuredTool({
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
        const bookingAny: any = booking;
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
  ];
}
