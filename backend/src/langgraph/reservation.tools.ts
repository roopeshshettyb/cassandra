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
  /** True once the notes have been read this turn; these tools are rebuilt for the next one. */
  let notesRead = false;
  /** The last booking note written this turn, so the same one is not written twice. */
  let lastNote = '';

  const tools = [
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
        'Write down something worth keeping that is not part of the booking itself — an occasion, a first visit, a preference, anything they want the hotel team to know. The dates, party size, name, phone and email go in note_reservation_dates instead. Give a subject so a later note about the same thing replaces the earlier one rather than contradicting it.',
      schema: z.object({
        subject: z
          .string()
          .describe('What this note is about, lowercase and consistent: preference, occasion, request'),
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
        // Once per turn. Nothing changes the notes between two reads inside one
        // turn, yet measured, the model re-read them until the turn hit its step
        // limit and died — after it had already spoken its reply. Telling it to
        // answer instead did not stop it, so a second read ends the turn.
        const cfg = constantsService.private.RESERVATION;
        if (notesRead) {
          ctx.endTurn?.();
          return JSON.stringify({ success: true, message: constantsService.public.RESERVATION_TOOL_BUDGET_SPENT });
        }
        notesRead = true;
        const notes = await messagesService.currentNotesByChatId(ctx.chatId, cfg.SCRATCHPAD_NOTE_LIMIT);
        return JSON.stringify({ success: true, data: notes.map((note) => ({ subject: note.subject, content: note.content })) });
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
        occasion: z.string().optional().describe('Anything they are celebrating or want the hotel team to know — an anniversary, a birthday, a honeymoon, a first visit, a request. Fill it the moment they mention it, even if it is the only thing you know so far'),
      }),
      func: async (args) => {
        // Measured: having noted a correction, the model wrote the same note three
        // more times in a row. Once is enough.
        if (JSON.stringify(args) === lastNote) {
          ctx.endTurn?.();
          return JSON.stringify({ success: true, message: constantsService.public.RESERVATION_TOOL_BUDGET_SPENT });
        }
        lastNote = JSON.stringify(args);
        const cfg = constantsService.private.RESERVATION;
        const current: Record<string, string> = {};
        (await messagesService.currentNotesByChatId(ctx.chatId, cfg.SCRATCHPAD_NOTE_LIMIT)).forEach((note) => {
          if (note.subject) current[note.subject] = note.content;
        });
        // Measured: dates noted as 5–7 November were overwritten turns later by a
        // note carrying only a check-in date — today's, re-derived from nothing —
        // and the enquiry went to the hotel for the wrong week. A real change of
        // dates comes with both; one date that contradicts what is already noted
        // is a slip, and is not written.
        const accepted: Record<string, unknown> = { ...args };
        const changesADate = (['checkInDate', 'checkOutDate'] as const).some((field) => args[field] && current[field] && args[field] !== current[field]);
        if (current.checkInDate && current.checkOutDate && changesADate && !(args.checkInDate && args.checkOutDate)) {
          delete accepted.checkInDate;
          delete accepted.checkOutDate;
        }
        // One note per field, so get_notes reads back the booking as it stands —
        // a call carrying only the newest detail leaves the earlier ones in place.
        await Promise.all(
          Object.entries(accepted)
            .filter(([, value]) => value !== undefined && value !== '')
            .map(([subject, value]) =>
              messagesService.createNote({
                chatId: ctx.chatId,
                accountId: ctx.account ? ctx.account.id : null,
                hotelId: hotelId ?? null,
                sourceMessageId: ctx.sourceMessageId ?? null,
                subject,
                content: String(value),
              }),
            ),
        );
        return JSON.stringify({
          success: true,
          message: constantsService.public.RESERVATION_DATES_NOTED,
          // The whole booking as it now stands, so the right dates are in front
          // of the agent every time it notes anything.
          data: { ...current, ...accepted },
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
        specialRequests: z.string().optional().describe('Anything the hotel team should know beyond the booking itself: an occasion such as an anniversary or birthday, a first visit, a preference, a request. Include everything you wrote down with add_note'),
      }),
      func: async (args) => {
        // Only what the caller actually gave. Measured: asked for an email, a caller
        // went off on a question about breakfast, and the agent recorded the enquiry
        // with an address it made up from the name — the schema requires one. Every
        // required detail must have been noted during the call, or nothing is recorded.
        const cfg = constantsService.private.RESERVATION;
        const notes = await messagesService.currentNotesByChatId(ctx.chatId, cfg.SCRATCHPAD_NOTE_LIMIT);
        const noted = new Set(notes.map((note) => note.subject));
        const missing = cfg.ENQUIRY_REQUIRED_NOTES.filter((field) => !noted.has(field));
        if (missing.length > 0) {
          return JSON.stringify({
            success: false,
            message: `${constantsService.public.RESERVATION_ENQUIRY_INCOMPLETE} ${missing.join(', ')}`,
          });
        }
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

  // A budget for the turn. Measured, the model can circle between its tools —
  // re-reading, re-noting — until the step cap kills the turn tens of seconds
  // later, with the caller waiting in silence. Asking it to stop was measured
  // not to work, so past the budget the turn is ended.
  let calls = 0;
  for (const tool of tools) {
    // Each tool has its own input type; the guard does not care which.
    const guarded: any = tool;
    const run = guarded.func;
    guarded.func = async (...args: any[]) => {
      calls += 1;
      if (calls > constantsService.private.RESERVATION.MAX_TOOL_CALLS_PER_TURN) {
        ctx.endTurn?.();
        return JSON.stringify({ success: false, message: constantsService.public.RESERVATION_TOOL_BUDGET_SPENT });
      }
      return run(...args);
    };
  }
  return tools;
}
