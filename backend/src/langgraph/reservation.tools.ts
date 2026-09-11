import { DynamicStructuredTool, StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
import { AgentToolContext } from './langgraph-tools.context';
import { RestaurantService } from '../restaurant/restaurant.service';
import { Hotel } from '../hotels/hotels.model';
import { ConstantsService } from '../common/constants/constants.service';

/**
 * The subset of a hotel an anonymous member of the public may see. This is an
 * allow-list on purpose: the row also carries wifiPassword, llmInstructions and
 * theme/avatar config, none of which belong in front of a stranger. Anything
 * added to the model stays hidden until it is named here.
 */
export function toPublicHotel(hotel: Hotel | null): Record<string, unknown> | null {
  if (!hotel) {
    return null;
  }
  const hotelRow: any = hotel;
  const brand = hotelRow.brand;
  return {
    id: hotel.id,
    name: hotel.name,
    address: hotel.address,
    checkInTime: hotel.checkInTime,
    checkOutTime: hotel.checkOutTime,
    poolHours: hotel.poolHours,
    gymHours: hotel.gymHours,
    restaurantHours: hotel.restaurantHours,
    breakfastHours: hotel.breakfastHours,
    lunchHours: hotel.lunchHours,
    dinnerHours: hotel.dinnerHours,
    snacksHours: hotel.snacksHours,
    houseKeepingHours: hotel.houseKeepingHours,
    roomServiceHours: hotel.roomServiceHours,
    logoUrl: hotel.logoUrl,
    images: hotel.images,
    website: hotel.website,
    phoneNumber: hotel.phoneNumber,
    googleMapsUrl: hotel.googleMapsUrl,
    brandName: brand?.name ?? null,
  };
}

/**
 * Tools for the public reservation agent. Every one is read-only or writes only
 * into the conversation itself — the agent has no account behind it, so it can
 * neither read another guest's data nor create a booking. The enquiry it
 * gathers lives in this chat's messages for staff to pick up.
 */
export function createReservationTools(
  ctx: AgentToolContext,
  restaurantService: RestaurantService,
  constantsService: ConstantsService,
): StructuredToolInterface[] {
  const hotelId = ctx.hotelId;

  return [
    new DynamicStructuredTool({
      name: 'get_hotel_details',
      description:
        'Get public details of the property being enquired about — name, address, check-in and check-out times, restaurant and amenity hours, phone number and website. Use this to answer questions about the hotel.',
      schema: z.object({}),
      func: async () => {
        return JSON.stringify(ctx.hotel);
      },
    }),
    new DynamicStructuredTool({
      name: 'search_menu',
      description:
        'Search the restaurant menu of this property. Use when the enquirer asks about food, dining, breakfast or prices. Returns the items servable at the current time of day, with name, description, price, category and dietary tags. Only items in their serving window come back, so an empty result means nothing is served right now rather than that the kitchen has no such dish.',
      schema: z.object({
        keywords: z
          .string()
          .optional()
          .describe(
            'Comma-separated terms matched against item names and descriptions only (e.g. "dosa, paneer"). Omit this to get everything currently servable — never pass filler like "all" or "menu", and note that dietary tags are not searchable, so filter those from the returned items yourself.',
          ),
      }),
      func: async (args) => {
        if (!hotelId) {
          return JSON.stringify([]);
        }
        const result = await restaurantService.searchPublicMenuItems(hotelId, args.keywords);
        return JSON.stringify(result.data);
      },
    }),
    new DynamicStructuredTool({
      name: 'record_reservation_enquiry',
      description:
        'Record the reservation enquiry once you have the dates, the number of guests and a name with either an email or a phone number. Call this exactly once, after confirming the details back to the enquirer. Recording it hands the enquiry to the hotel team, who will confirm the booking; you cannot confirm a booking yourself.',
      schema: z.object({
        guestName: z.string().describe('Full name of the person making the reservation'),
        guestEmail: z.string().optional().describe('Email address, if given'),
        guestPhone: z.string().optional().describe('Phone number, if given'),
        checkInDate: z.string().describe('Requested check-in date as YYYY-MM-DD'),
        checkOutDate: z.string().describe('Requested check-out date as YYYY-MM-DD'),
        partySize: z.number().describe('Number of guests staying'),
        roomPreference: z.string().optional().describe('Room type or preference mentioned, if any'),
        specialRequests: z.string().optional().describe('Anything else the enquirer asked for'),
      }),
      func: async (args) => {
        // No table by design: the enquiry is the tool call, persisted on the
        // assistant message and read back from the chat by hotel staff.
        return JSON.stringify({
          success: true,
          message: constantsService.public.RESERVATION_ENQUIRY_RECORDED,
          data: { hotelId: hotelId ?? null, chatId: ctx.chatId, ...args, recordedAt: new Date().toISOString() },
        });
      },
    }),
  ];
}
