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

// Where 0 sits in ASCII, Devanagari, Tamil, Telugu and Kannada.
const NUMERAL_ZEROS = [0x30, 0x966, 0xbe6, 0xc66, 0xce6];

/** Numerals in any of the five scripts as ASCII digits: "೯೦" is "90". */
export function asciiNumerals(text: string): string {
  return text.replace(/\p{Nd}/gu, (numeral) => String(NUMERAL_ZEROS.map((zero) => numeral.codePointAt(0) - zero).find((value) => value >= 0 && value <= 9) ?? ''));
}

/** The digits in what the caller said: numerals in any script, number words in any of the five languages. */
export function spokenDigits(text: string, words: Record<string, string>): string {
  return asciiNumerals(text.normalize('NFC').toLowerCase())
    .replace(/[\p{L}\p{M}]+/gu, (word) => words[word] ?? word)
    .replace(/x([23])\D*(\d)/g, (_, times: string, digit: string) => digit.repeat(Number(times)))
    .replace(/\D/g, '');
}

/**
 * The booking details that cannot be right, by field. Dates are YYYY-MM-DD, so
 * they compare as strings. Only fields present are judged.
 */
export function bookingProblems(fields: Record<string, unknown>, today: string, limits: { MAX_PARTY_SIZE: number; PHONE_DIGITS: { MIN: number; MAX: number } }): string[] {
  const { checkInDate, checkOutDate, partySize, guestPhone, guestEmail } = fields;
  const phoneDigits = String(guestPhone ?? '').replace(/\D/g, '').length;
  const wrong: Record<string, boolean> = {
    checkInDate: typeof checkInDate === 'string' && checkInDate < today,
    checkOutDate: typeof checkOutDate === 'string' && typeof checkInDate === 'string' && checkOutDate <= checkInDate,
    partySize: partySize !== undefined && !(Number(partySize) >= 1 && Number(partySize) <= limits.MAX_PARTY_SIZE),
    guestPhone: guestPhone !== undefined && (phoneDigits < limits.PHONE_DIGITS.MIN || phoneDigits > limits.PHONE_DIGITS.MAX),
    guestEmail: guestEmail !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(guestEmail)),
  };
  return Object.keys(wrong).filter((field) => wrong[field]);
}

// The Indian scripts sit in 128-code-point blocks laid out alike, Devanagari (0x900) to Malayalam (0xd7f).
const INDIC_FIRST = 0x900;
const INDIC_LAST = 0xd7f;

/**
 * Letters from another Indian script moved into the one the caller wrote in, by
 * their shared layout. Measured: copying "ಕಿರಣ್ ಟೆಸ್ಟ್", the model wrote "ಕಿರಣ್ ಟెస్ట్",
 * Kannada with Telugu letters in it, and that was saved as the guest's name.
 */
export function inScriptOf(text: string, sample: string): string {
  const own = [...sample].map((c) => c.codePointAt(0)).find((cp) => cp >= INDIC_FIRST && cp <= INDIC_LAST);
  if (own === undefined) return text;
  const block = own & ~0x7f;
  return text.replace(/[\u0900-\u0d7f]/g, (c) => String.fromCodePoint(block + (c.codePointAt(0) & 0x7f)));
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

  // The latest note on each subject, so the booking as it now stands.
  const currentNotes = async (): Promise<Record<string, string>> =>
    Object.fromEntries(
      (await messagesService.currentNotesByChatId(ctx.chatId, constantsService.private.RESERVATION.SCRATCHPAD_NOTE_LIMIT))
        .filter((note) => note.subject)
        .map((note) => [note.subject, note.content]),
    );

  const extrasSchema = z.object({
    roomPreference: z.string().optional().describe('Room type or preference mentioned, if any'),
    specialRequests: z.string().optional().describe('Anything the hotel team should know beyond the booking itself: an occasion such as an anniversary or birthday, a first visit, a preference, a request'),
  });
  /**
   * The booking exactly as noted — what the caller gave and heard read back.
   * Measured: passed in by the agent, a name misheard as "Dave" was recorded
   * against notes that said "Dev", so the record was refused and the caller was
   * told it was done. Every required detail must be noted, or nothing is recorded.
   */
  const recordFromNotes = async (extras: z.infer<typeof extrasSchema>) => {
    const cfg = constantsService.private.RESERVATION;
    const notes = await currentNotes();
    const missing = cfg.ENQUIRY_REQUIRED_NOTES.filter((field) => !notes[field]);
    if (missing.length > 0) {
      return JSON.stringify({ success: false, message: `${cfg.NOTE_RESULTS.INCOMPLETE} ${missing.join(', ')}` });
    }
    const booking: Record<string, unknown> = { ...Object.fromEntries(cfg.ENQUIRY_REQUIRED_NOTES.map((field) => [field, notes[field]])), partySize: Number(notes.partySize), ...extras };
    // Notes taken yesterday can be past today; anything wrong goes back to the caller.
    const invalid = bookingProblems(booking, new Date().toISOString().slice(0, 10), cfg);
    if (invalid.length > 0) {
      return JSON.stringify({ success: false, message: `${cfg.NOTE_RESULTS.INVALID} ${invalid.map((field) => cfg.BOOKING_PROBLEMS[field]).join('; ')}` });
    }
    // Recorded once is enough. Measured: each "yes" after "Done" recorded the same
    // booking again, and staff saw it three times. A changed booking goes through.
    const recorded = (await messagesService.findRecentByChatId(ctx.chatId, cfg.HISTORY_MESSAGE_LIMIT))
      .flatMap((message) => message.toolCalls ?? [])
      .filter((call) => call.toolName === 'record_reservation_enquiry' && String(call.output).includes('"success":true'));
    const last = recorded.length ? JSON.parse(String(recorded[recorded.length - 1].output)).data : null;
    if (last && cfg.ENQUIRY_REQUIRED_NOTES.every((field) => String(last[field]) === String(booking[field]))) {
      return JSON.stringify({ success: false, message: cfg.NOTE_RESULTS.ALREADY_RECORDED });
    }
    // No table by design: the enquiry is the tool call, persisted on the
    // assistant message and read back from the chat by hotel staff.
    return JSON.stringify({
      success: true,
      message: cfg.NOTE_RESULTS.RECORDED,
      data: { hotelId: hotelId ?? null, chatId: ctx.chatId, ...booking, recordedAt: new Date().toISOString() },
    });
  };

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
  ];
  // Written down by a note-taker once the reply is out, so the caller is not kept
  // waiting for a second round trip while a detail is written down.
  const scribe = [
    // The only way a booking is handed over: the agent only talks. Measured: given the
    // tool, she forgot it (a Tamil yes, nothing recorded), and once a save was refused
    // she looped on it, fell silent, or said "done" with nothing sent.
    new DynamicStructuredTool({
      name: 'record_reservation_enquiry',
      description:
        'Hand the booking to the hotel team. Call it only when the caller has just said yes to the agent reading back the whole booking — dates, guests, name, phone and email together — not to a single detail. If it is already handed over, this does nothing.',
      schema: extrasSchema,
      func: recordFromNotes,
    }),
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
        guestName: z.string().optional().describe('The name exactly as they gave it, in the script they used: "ಕಿರಣ್ ಟೆಸ್ಟ್" stays "ಕಿರಣ್ ಟೆಸ್ಟ್", never "Kiran Test"; never translated or put into English letters. Spelled letter by letter, the letters assembled: "Ram", never "R A M" or "Ram, R A M"'),
        guestNameAsSaid: z.string().optional().describe('With guestName: the name exactly as they said or wrote it, copied from their words in their own script — "राम", "R A M"'),
        guestPhone: z.string().optional().describe('Phone number, digits only, as soon as they have given it'),
        guestEmail: z.string().optional().describe('The address itself, assembled from the letters they spelled: "ram@gmail.com", never "r a m at gmail dot com"'),
        occasion: z.string().optional().describe('Something they are celebrating, or something they ask the hotel to arrange for their stay — an anniversary, a birthday, a honeymoon, a first visit, an early check-in. Never a question about the hotel: a question is answered, not noted. Fill it the moment they mention it, even if it is the only thing you know so far'),
      }),
      func: async (args) => {
        const cfg = constantsService.private.RESERVATION;
        const current = await currentNotes();
        // Measured: dates noted as 5–7 November were overwritten turns later by a
        // note carrying only a check-in date — today's, re-derived from nothing —
        // and the enquiry went to the hotel for the wrong week. A real change of
        // dates comes with both; one date that contradicts what is already noted
        // is a slip, and is not written.
        for (const key of ['guestName', 'guestNameAsSaid'] as const) {
          if (typeof args[key] === 'string') args[key] = inScriptOf(args[key], ctx.sourceText ?? '');
        }
        const accepted: Record<string, unknown> = { ...args };
        // Only the evidence for a name, not a note of its own.
        delete accepted.guestNameAsSaid;
        // Spelled, the letters are the name. Measured: "my name is Srijit,
        // spelling is S H R I J I T" was noted as Srijit — the word the speech
        // recogniser heard, not the name the caller spelled.
        const spelled = (ctx.sourceText ?? '').match(/(?<![\p{L}\p{M}])[A-Za-z](?:[\s,.-]+[A-Za-z](?![\p{L}\p{M}])){2,}/gu)?.pop()?.replace(/[^A-Za-z]/g, '');
        // Also when the letters match: "D E V" and "DEV" were saved as given, not as "Dev".
        if (typeof accepted.guestName === 'string' && spelled) {
          accepted.guestName = spelled.charAt(0).toUpperCase() + spelled.slice(1).toLowerCase();
        }
        // A detail already noted changes only when the caller has just said the new
        // one. Measured: with every detail noted correctly, a later note re-typed the
        // whole booking with a phone number and dates nobody had said — the email
        // was what the caller was giving at the time — and they were recorded.
        // Numerals as ASCII, so "೧೦ ಡಿಸೆಂಬರ್" counts as a date as much as "10 December" does.
        const said = asciiNumerals(ctx.sourceText ?? '');
        // Vowel signs count: without them "ಟెಸ್ಟ್", with a Telugu one, passed for "ಟೆಸ್ಟ್".
        const letters = (text: string) => text.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{M}]/gu, '');
        const heardDigits = spokenDigits(said, cfg.SPOKEN_DIGITS);
        const mentionsADate = /(^|\D)([1-9]|[12]\d|3[01])(\D|$)/.test(said) || new RegExp(cfg.DATE_PATTERN, 'iu').test(said);
        // Each needs something to match: an empty string is in everything, and
        // measured, a phone number noted as the email passed for that reason.
        const heardIn = (text: string, part: string) => part.length > 0 && text.includes(part);
        const evidence: Record<string, (value: string) => boolean> = {
          guestPhone: (value) => value.replace(/\D/g, '').length >= 6 && heardIn(heardDigits, value.replace(/\D/g, '').slice(-6)),
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
        // A detail that cannot be right is not written down, so it can never be recorded.
        const invalid = bookingProblems({ ...current, ...accepted }, new Date().toISOString().slice(0, 10), cfg).filter((field) => field in accepted);
        // The dates go together: a check-out kept after its check-in was refused left the notes contradicting each other.
        if (invalid.some((field) => field.endsWith('Date'))) invalid.push(...['checkInDate', 'checkOutDate'].filter((field) => field in accepted && !invalid.includes(field)));
        invalid.forEach((field) => delete accepted[field]);
        // New dates that cannot be booked still mean the old ones are no longer wanted.
        // Measured: past dates were refused, the earlier ones stood, and the caller's
        // yes saved a stay they had moved away from. Cleared, she has to ask again.
        const cleared = invalid.some((field) => field.endsWith('Date')) ? ['checkInDate', 'checkOutDate'].filter((field) => current[field]) : [];
        // One note per field, so the notes read back the booking as it stands —
        // a call carrying only the newest detail leaves the earlier ones in place.
        await Promise.all(
          [
            ...Object.entries(accepted).filter(([, value]) => value !== undefined && value !== ''),
            ...cleared.map((field) => [field, '']),
            // What was refused and why, for the agent's next turn: a list of missing
            // fields was not enough to stop her reading refused dates back as booked.
            ...(invalid.length || current.refused ? [['refused', invalid.map((field) => `${cfg.BOOKING_PROBLEMS[field]} (they gave ${args[field]})`).join('; ')]] : []),
          ]
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
          message: [
            kept.length ? `${cfg.NOTE_RESULTS.KEPT} ${kept.join(', ')}` : '',
            invalid.map((field) => cfg.BOOKING_PROBLEMS[field]).join('; '),
          ].filter(Boolean).join(' ') || cfg.NOTE_RESULTS.NOTED,
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
