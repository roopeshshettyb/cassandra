import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { AgentToolContext } from './langgraph-tools.context';
import { BookingsService } from '../bookings/bookings.service';
import { RequestsService } from '../requests/requests.service';
import { RequestType, RequestUrgency, RequestStatus } from '../requests/requests.model';
import { CreateRequestDto } from '../requests/requests.dto';

export function createAgentTools(ctx: AgentToolContext, bookingsService: BookingsService, requestsService: RequestsService): DynamicStructuredTool[] {
  const { account, bookingId, chatId, hotel, booking } = ctx;

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
  ];
}
