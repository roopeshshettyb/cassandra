import { DynamicStructuredTool, StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
import { AgentToolContext } from './langgraph-tools.context';
import { RestaurantService } from '../restaurant/restaurant.service';
import { Hotel } from '../hotels/hotels.model';
import { ConstantsService } from '../common/constants/constants.service';
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
  messagesService: MessagesService,
): { reply: StructuredToolInterface[]; scribe: StructuredToolInterface[] } {
  const hotelId = ctx.hotelId;

  const reply = [
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
        guestName: z.string().describe('Full name of the person making the reservation, as a name — never with its spelling appended'),
        guestEmail: z.string().describe('Email address as a working address, required — spell it back to them, but record it assembled, never letter by letter'),
        guestPhone: z.string().optional().describe('Phone number, if given'),
        checkInDate: z.string().describe('Requested check-in date as YYYY-MM-DD'),
        checkOutDate: z.string().describe('Requested check-out date as YYYY-MM-DD'),
        partySize: z.number().describe('Number of guests staying'),
        roomPreference: z.string().optional().describe('Room type or preference mentioned, if any'),
        specialRequests: z.string().optional().describe('Anything the hotel team should know beyond the booking itself: an occasion such as an anniversary or birthday, a first visit, a preference, a request. Include every occasion, preference and request in the notes'),
      }),
      func: async (args) => {
        // Only what the caller actually gave. Measured: asked for an email, a caller
        // went off on a question about breakfast, and the agent recorded the enquiry
        // with an address it made up from the name — the schema requires one. Every
        // required detail must have been noted during the call, or nothing is recorded.
        const cfg = constantsService.private.RESERVATION;
        const notes: Record<string, string> = {};
        (await messagesService.currentNotesByChatId(ctx.chatId, cfg.SCRATCHPAD_NOTE_LIMIT)).forEach((note) => {
          if (note.subject) notes[note.subject] = note.content;
        });
        const missing = cfg.ENQUIRY_REQUIRED_NOTES.filter((field) => !notes[field]);
        if (missing.length > 0) {
          return JSON.stringify({
            success: false,
            message: `${constantsService.public.RESERVATION_ENQUIRY_INCOMPLETE} ${missing.join(', ')}`,
          });
        }
        // The record must be what was noted — what the caller confirmed — not what
        // the model remembers. A read-back from memory can drift; the notes cannot.
        const same = (field: string, a: unknown, b: string) =>
          field === 'guestPhone' ? String(a).replace(/\D/g, '').endsWith(b.replace(/\D/g, '').slice(-10))
            : String(a).trim().toLowerCase() === b.trim().toLowerCase();
        const differs = cfg.ENQUIRY_REQUIRED_NOTES.filter((field) => !same(field, args[field], notes[field]));
        if (differs.length > 0) {
          return JSON.stringify({
            success: false,
            message: `${constantsService.public.RESERVATION_ENQUIRY_MISMATCH} ${differs.map((field) => `${field} (notes: ${notes[field]})`).join(', ')}`,
          });
        }
        // Recorded once is enough. Measured: each "yes" after "Done — the team will
        // call you" recorded the same booking again, and staff saw it three times.
        // A change since, such as new dates, is a new booking and goes through.
        const recorded = (await messagesService.findRecentByChatId(ctx.chatId, cfg.HISTORY_MESSAGE_LIMIT))
          .flatMap((message) => message.toolCalls ?? [])
          .filter((call) => call.toolName === 'record_reservation_enquiry' && String(call.output).includes('"success":true'));
        const last = recorded[recorded.length - 1]?.input;
        const fields = new Set([...Object.keys(last ?? {}), ...Object.keys(args)]);
        if (last && [...fields].every((field) => String(last[field] ?? '') === String(args[field] ?? ''))) {
          return JSON.stringify({ success: false, message: constantsService.public.RESERVATION_ENQUIRY_ALREADY_RECORDED });
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
  // Written down by a note-taker once the reply is out, so the caller is not kept
  // waiting for a second round trip while a detail is written down.
  const scribe = [
    new DynamicStructuredTool({
      name: 'add_note',
      description:
        'Only for something they ask the hotel team to arrange or know for their stay that is not part of the booking — a dietary need, a room or bed preference, an arrival time, an accessibility need. A question about the hotel is not one: it has been answered, not requested. The dates, party size, name, phone and email go in note_reservation_dates instead. Give a subject so a later note about the same thing replaces the earlier one rather than contradicting it.',
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
      name: 'note_reservation_dates',
      description:
        'Write down what the enquirer has just told you, the moment they tell you: their dates first, then each further detail — the party size, the name, the phone number, the email — as you get it. Pass only what is new or what they have just corrected; everything noted before is kept for you. Everything recorded at the end of the call is taken from these notes, not from memory.',
      schema: z.object({
        checkInDate: z.string().optional().describe('Resolved check-in date as YYYY-MM-DD'),
        checkOutDate: z.string().optional().describe('Resolved check-out date as YYYY-MM-DD. Leave it out until they have actually given you one — do not pick a checkout for them'),
        partySize: z.number().optional().describe('How many people are staying, as soon as they have said — people, never rooms: "a room" says nothing about how many are coming'),
        guestName: z.string().optional().describe('The name itself, in English letters, assembled from the letters they spelled: "Ram", never "R A M", never "Ram, R A M", and never "राम" even when the call is in Hindi'),
        guestNameAsSaid: z.string().optional().describe('With guestName: the name exactly as they said or wrote it, copied from their words in their own script — "राम", "R A M"'),
        guestPhone: z.string().optional().describe('Phone number, digits only, as soon as they have given it'),
        guestEmail: z.string().optional().describe('The address itself, assembled from the letters they spelled: "ram@gmail.com", never "r a m at gmail dot com"'),
        occasion: z.string().optional().describe('Something they are celebrating, or something they ask the hotel to arrange for their stay — an anniversary, a birthday, a honeymoon, a first visit, an early check-in. Never a question about the hotel: a question is answered, not noted. Fill it the moment they mention it, even if it is the only thing you know so far'),
      }),
      func: async (args) => {
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
        // Only the evidence for a name, not a note of its own.
        delete accepted.guestNameAsSaid;
        // Spelled, the letters are the name. Measured: "my name is Srijit,
        // spelling is S H R I J I T" was noted as Srijit — the word the speech
        // recogniser heard, not the name the caller spelled.
        const spelled = (ctx.sourceText ?? '').match(/(?<![\p{L}\p{M}])[A-Za-z](?:[\s,.-]+[A-Za-z](?![\p{L}\p{M}])){2,}/gu)?.pop()?.replace(/[^A-Za-z]/g, '');
        if (typeof accepted.guestName === 'string' && spelled && spelled.toLowerCase() !== accepted.guestName.toLowerCase().replace(/[^\p{L}]/gu, '')) {
          accepted.guestName = spelled.charAt(0).toUpperCase() + spelled.slice(1).toLowerCase();
        }
        // A detail already noted changes only when the caller has just said the new
        // one. Measured: with every detail noted correctly, a later note re-typed the
        // whole booking with a phone number and dates nobody had said — the email
        // was what the caller was giving at the time — and they were recorded.
        const said = ctx.sourceText ?? '';
        const letters = (text: string) => text.toLowerCase().replace(/[^\p{L}]/gu, '');
        const spokenDigits = said.toLowerCase().replace(/\b[a-z]+\b/g, (word) => cfg.SPOKEN_DIGITS[word] ?? word).replace(/\D/g, '');
        const mentionsADate = /(^|\D)([1-9]|[12]\d|3[01])(\D|$)/.test(said) || new RegExp(cfg.DATE_PATTERN, 'iu').test(said);
        // Each needs something to match: an empty string is in everything, and
        // measured, a phone number noted as the email passed for that reason.
        const heardIn = (text: string, part: string) => part.length > 0 && text.includes(part);
        const evidence: Record<string, (value: string) => boolean> = {
          guestPhone: (value) => value.replace(/\D/g, '').length >= 6 && heardIn(spokenDigits, value.replace(/\D/g, '').slice(-6)),
          guestEmail: (value) => value.includes('@') && heardIn(letters(said), letters(value.split('@')[0])),
          // A name given in another script is checked as they wrote it, since "राम" holds no English letters.
          guestName: (value) => heardIn(letters(said), letters(value)) || heardIn(letters(said), letters(args.guestNameAsSaid ?? '')),
          checkInDate: () => mentionsADate,
          checkOutDate: () => mentionsADate,
        };
        // A name, phone or email is the caller's own, so it is written only when
        // they have just said it, the first time as much as any other. Measured:
        // asked for an email, a caller said "yeah, that's good" and an address
        // made from their name was noted. Dates can be agreed to — "the
        // twentieth, then?" "yes" — so only a change to them needs them said.
        const kept = Object.keys(evidence).filter((field) => {
          const value = args[field];
          const mustBeSaid = current[field] || cfg.CALLER_SPOKEN_NOTES.includes(field);
          return typeof value === 'string' && value !== current[field] && mustBeSaid && !evidence[field](value);
        });
        kept.forEach((field) => delete accepted[field]);
        // What is already noted as said is not written again.
        Object.keys(accepted).forEach((field) => String(accepted[field]) === current[field] && delete accepted[field]);
        const changesADate = (['checkInDate', 'checkOutDate'] as const).some((field) => args[field] && current[field] && args[field] !== current[field]);
        if (current.checkInDate && current.checkOutDate && changesADate && !(args.checkInDate && args.checkOutDate)) {
          delete accepted.checkInDate;
          delete accepted.checkOutDate;
        }
        // One note per field, so the notes read back the booking as it stands —
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
          message: kept.length
            ? `${constantsService.public.RESERVATION_NOTE_KEPT} ${kept.join(', ')}`
            : constantsService.public.RESERVATION_DATES_NOTED,
          // The whole booking as it now stands, so the right dates are in front
          // of the agent every time it notes anything.
          data: { ...current, ...accepted },
        });
      },
    }),
  ];

  // A budget for the turn. Measured, the model can circle between its tools —
  // re-reading, re-noting, searching the menu again for what it just returned —
  // until the step cap kills the turn tens of seconds later, with the caller
  // waiting in silence. Asking it to stop was measured not to work, so past the
  // budget, or at a call repeated word for word, the turn is ended. The
  // note-taker makes one call and cannot circle.
  let calls = 0;
  const made = new Set<string>();
  for (const tool of reply) {
    // Each tool has its own input type; the guard does not care which.
    const guarded: any = tool;
    const run = guarded.func;
    guarded.func = async (...args: any[]) => {
      calls += 1;
      const call = `${tool.name} ${JSON.stringify(args[0])}`;
      if (calls > constantsService.private.RESERVATION.MAX_TOOL_CALLS_PER_TURN || made.has(call)) {
        ctx.endTurn?.();
        return JSON.stringify({ success: false, message: constantsService.public.RESERVATION_TOOL_BUDGET_SPENT });
      }
      made.add(call);
      return run(...args);
    };
  }
  return { reply, scribe };
}
