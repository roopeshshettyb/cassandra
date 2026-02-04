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
        if (hotelId == null || guestId == null) {
          const { data: b } = await bookingsService.findByIdForAccount(bookingId, account);
          const dto: CreateRequestDto = {
            hotelId: b.hotelId,
            guestId: b.guestId,
            bookingId,
            requestType: args.requestType,
            urgency: args.urgency,
            userNotes: args.userNotes ?? [],
            chatId,
            ...(args.data != null && { data: args.data }),
          };
          const result = await requestsService.create(dto, account);
          return JSON.stringify(result);
        }
        const dto: CreateRequestDto = {
          hotelId,
          guestId,
          bookingId,
          requestType: args.requestType,
          urgency: args.urgency,
          userNotes: args.userNotes ?? [],
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
      name: 'append_user_message',
      description: 'Append a user (guest) message to an existing request.',
      schema: z.object({
        requestId: z.number(),
        message: z.string(),
      }),
      func: async (args) => {
        const result = await requestsService.appendUserMessage(args.requestId, args.message, account);
        return JSON.stringify(result);
      },
    }),
    new DynamicStructuredTool({
      name: 'append_staff_message',
      description: 'Append a staff note to an existing request. Use when acting on behalf of hotel staff.',
      schema: z.object({
        requestId: z.number(),
        message: z.string(),
      }),
      func: async (args) => {
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
