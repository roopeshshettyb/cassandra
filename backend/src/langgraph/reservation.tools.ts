import { DynamicStructuredTool, StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
import { AgentToolContext } from './langgraph-tools.context';
import { RestaurantService } from '../restaurant/restaurant.service';
import { Hotel } from '../hotels/hotels.model';
import { ConstantsService } from '../common/constants/constants.service';
import { ChatService } from '../chat/chat.service';
import { MessagesService } from '../messages/messages.service';

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
  chatService: ChatService,
  messagesService: MessagesService,
): StructuredToolInterface[] {
  const hotelId = ctx.hotelId;
  /** Memoised for this turn only; these tools are rebuilt for the next one. */
  let notesThisTurn: Promise<{ subject: string | null; content: string }[]> | null = null;

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
      name: 'add_note',
      description:
        'Write something down about this enquirer the moment they tell you, so you do not have to hold it in your head for the rest of the call. Use it for anything you will need later: their dates, how many are staying, a name, a number, a preference, a reason for the trip, anything they ask you to remember. Give a subject so a later note about the same thing replaces the earlier one rather than contradicting it.',
      schema: z.object({
        subject: z
          .string()
          .describe('What this note is about, lowercase and consistent: dates, party size, name, phone, email, preference, occasion'),
        content: z.string().describe('The note itself, written so it reads on its own later'),
      }),
      func: async (args) => {
        const note = await messagesService.createNote({
          chatId: ctx.chatId,
          accountId: ctx.account ? ctx.account.id : null,
          hotelId: hotelId ?? null,
          // What was said to produce this, so a note is never just an assertion.
          sourceMessageId: ctx.sourceMessageId ?? null,
          subject: args.subject,
          content: args.content,
        });
        return JSON.stringify({ success: true, data: { id: note.id, subject: args.subject } });
      },
    }),
    new DynamicStructuredTool({
      name: 'get_notes',
      description:
        'Read back everything you have written down on this call. Use it before you summarise, before you record the enquiry, and any time you are about to ask for something in case you already have it. What comes back is what you were told; it beats anything you are reconstructing from memory.',
      schema: z.object({}),
      func: async () => {
        // Once per turn. Nothing can change the notes between two reads inside
        // one turn, so a second call is the model re-reading rather than new
        // information, and it should cost nothing.
        if (!notesThisTurn) {
          const cfg = constantsService.private.RESERVATION;
          notesThisTurn = messagesService
            .currentNotesByChatId(ctx.chatId, cfg.SCRATCHPAD_NOTE_LIMIT)
            .then((notes) => notes.map((note) => ({ subject: note.subject, content: note.content })));
        }
        return JSON.stringify({ success: true, data: await notesThisTurn });
      },
    }),
    new DynamicStructuredTool({
      name: 'set_chat_language',
      description:
        'Store the language this call is being held in, as soon as you know it from the first thing they say. Until it is stored the language is decided again on every turn, which is how a call drifts back into English. Call it again only if they genuinely start speaking another language — not because they spelled something in English letters.',
      schema: z.object({
        languageCode: z
          .enum(['en', 'hi', 'kn', 'ta', 'te'])
          .describe('The ISO-639-1 language code for this call (en, hi, kn, ta, or te).'),
      }),
      func: async (args) => {
        await chatService.updateLanguageCode(ctx.chatId, args.languageCode);
        // Also on the live session, so the voice that speaks the rest of this
        // call follows it without waiting for a reconnect to re-read the row.
        ctx.languageCode = args.languageCode;
        return JSON.stringify({ success: true, languageCode: args.languageCode });
      },
    }),
    new DynamicStructuredTool({
      name: 'note_reservation_dates',
      description:
        'Write down what the enquirer has just told you, the moment they tell you. Call it first with their dates, and again after every further detail — the party size, the name, the phone number, the email — carrying whatever you now know. Call it again whenever they correct something. Everything recorded at the end of the call is taken from these notes, not from memory.',
      schema: z.object({
        checkInDate: z.string().optional().describe('Resolved check-in date as YYYY-MM-DD'),
        checkOutDate: z.string().optional().describe('Resolved check-out date as YYYY-MM-DD. Leave it out until they have actually given you one — do not pick a checkout for them'),
        partySize: z.number().optional().describe('Number of guests, as soon as they have said'),
        guestName: z.string().optional().describe('The name itself, assembled from the letters they spelled: "Ram", never "R A M" and never "Ram, R A M"'),
        guestPhone: z.string().optional().describe('Phone number, digits only, as soon as they have given it'),
        guestEmail: z.string().optional().describe('The address itself, assembled from the letters they spelled: "ram@gmail.com", never "r a m at gmail dot com"'),
      }),
      func: async (args) => {
        // Nothing is stored here: the call itself is persisted on the assistant
        // message, and context is built with tool inputs inline, so the details
        // return to every later prompt as data rather than as words to re-read.
        return JSON.stringify({
          success: true,
          message: constantsService.public.RESERVATION_DATES_NOTED,
          data: { ...args },
        });
      },
    }),
    new DynamicStructuredTool({
      name: 'record_reservation_enquiry',
      description:
        'Record the reservation enquiry once you have the dates, the number of guests and a name with either an email or a phone number. Call this exactly once, after confirming the details back to the enquirer. Recording it hands the enquiry to the hotel team, who will confirm the booking; you cannot confirm a booking yourself.',
      schema: z.object({
        guestName: z.string().describe('Full name of the person making the reservation, as a name — never with its spelling appended'),
        guestEmail: z.string().describe('Email address as a working address, required — spell it back to them, but record it assembled, never letter by letter'),
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
