import { Injectable, NotFoundException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { ChatService } from '../chat/chat.service';
import { HotelsService } from '../hotels/hotels.service';
import { MessagesService } from '../messages/messages.service';
import { CacheService } from '../common/cache/cache.service';
import { ConstantsService } from '../common/constants/constants.service';
import { toPublicHotel } from '../langgraph/reservation.tools';
import { Chat } from '../chat/chat.model';
import { Hotel } from '../hotels/hotels.model';
import { Message } from '../messages/message.model';
import { Account } from '../accounts/accounts.model';
import { ChatSession } from '../chat/gateway/chat-session.interface';
import { LoggerService } from '../common/logger.service';

export interface ReservationSessionResult {
  /** Null until the visitor actually says something — see startSession. */
  chat: Chat | null;
  hotel: Hotel;
  publicHotel: Record<string, unknown> | null;
  sessionToken: string | null;
  messages: Message[];
}

/**
 * Undo a spelling that was recorded instead of the value it spells.
 *
 * The agent is told to have names and addresses spelled out, and it sometimes
 * writes down the letters rather than what they assemble to — "Ram, R A N",
 * "S H R I J I T M O R E 5 5 6 @ gmail.com". The prompt and the tool now ask for
 * the assembled value, but a staff member should not be shown letters because a
 * model drifted, so the obvious cases are undone here as well.
 *
 * Conservative on purpose: a run of single characters is only ever a spelling,
 * but "Mary Jane" and "J K Rowling" must survive untouched.
 */
function unspell(value: unknown, stripSpaces: boolean): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const text = value.trim();
  if (!text) {
    return value;
  }
  // An address can never contain a space, so any spacing in one is a spelling.
  if (stripSpaces && /\s/.test(text)) {
    return text.replace(/\s+/g, '');
  }
  // "Ram, R A N" — a tail of single characters spells the head.
  const tail = /^(.*?),\s*((?:[A-Za-z0-9]\s+){2,}[A-Za-z0-9])\s*$/.exec(text);
  if (tail) {
    return tail[1].trim();
  }
  // "R A N" on its own is a spelling with nothing else to fall back on.
  if (/^(?:[A-Za-z0-9]\s+){2,}[A-Za-z0-9]$/.test(text)) {
    return text.replace(/\s+/g, '');
  }
  return text;
}

@Injectable()
export class ReservationService {
  constructor(
    private readonly chatService: ChatService,
    private readonly hotelsService: HotelsService,
    private readonly messagesService: MessagesService,
    private readonly cacheService: CacheService,
    private readonly constantsService: ConstantsService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Signed handle for an anonymous reservation chat. There is no account to
   * check ownership against, so the signature is what stops one visitor from
   * resuming another's conversation by guessing a chat id.
   */
  private signSessionToken(chatId: number, expiresAt: number): string {
    const cfg = this.constantsService.private.RESERVATION;
    const payload = `${chatId}${cfg.SESSION_TOKEN_SEPARATOR}${expiresAt}`;
    const signature = createHmac(cfg.SESSION_TOKEN_HASH_ALGORITHM, this.constantsService.private.JWT_SECRET)
      .update(payload)
      .digest('hex');
    return `${payload}${cfg.SESSION_TOKEN_SEPARATOR}${signature}`;
  }

  private issueSessionToken(chatId: number): string {
    const cfg = this.constantsService.private.RESERVATION;
    const expiresAt = Date.now() + cfg.SESSION_TOKEN_TTL_HOURS * 60 * 60 * 1000;
    return this.signSessionToken(chatId, expiresAt);
  }

  /** Chat id carried by a valid, unexpired token; null for anything else. */
  private verifySessionToken(token: string | null | undefined): number | null {
    if (!token) {
      return null;
    }
    const cfg = this.constantsService.private.RESERVATION;
    const parts = token.split(cfg.SESSION_TOKEN_SEPARATOR);
    if (parts.length !== 3) {
      return null;
    }
    const chatId = parseInt(parts[0], 10);
    const expiresAt = parseInt(parts[1], 10);
    if (isNaN(chatId) || isNaN(expiresAt) || Date.now() > expiresAt) {
      return null;
    }
    const expected = Buffer.from(this.signSessionToken(chatId, expiresAt));
    const received = Buffer.from(token);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      return null;
    }
    return chatId;
  }

  /** Caller's address, preferring the proxy header the load balancer sets. */
  clientIp(client: any): string {
    const forwarded = client.handshake?.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    return client.handshake?.address ?? '';
  }

  /**
   * Hotel id from the handshake, or null. Deliberately strict: a repeated query
   * param arrives as an array, and parseInt would read "1 OR 1=1" or "1abc" as
   * hotel 1. Nothing good comes of guessing which hotel a malformed id meant.
   */
  private parseHotelId(raw: unknown): number | null {
    if (typeof raw !== 'string' && typeof raw !== 'number') {
      return null;
    }
    const value = String(raw).trim();
    if (!/^[0-9]+$/.test(value)) {
      return null;
    }
    const hotelId = Number(value);
    return hotelId > 0 ? hotelId : null;
  }

  /**
   * A reservation session: no account by design, scoped to a hotel rather than a
   * booking. The absent account is what routes the turn to the reservation prompt
   * and its read-only tools.
   */
  private buildSession(client: any, chat: Chat): ChatSession {
    const context = client.reservationContext;
    return {
      account: null,
      bookingId: null,
      hotelId: context.hotelId,
      chatId: chat.id,
      hotel: context.publicHotel,
      booking: null,
      languageCode: chat.languageCode ?? null,
    };
  }

  /**
   * Open a reservation socket, text or voice alike: resolve the hotel, resume the
   * conversation the handshake's token points at, and tell the client. Returns
   * null when the connection was refused — the client has already been told why.
   *
   * The token is read from auth as well as query: a query is fixed when the
   * socket is built, before any chat exists, so only auth survives a reconnect.
   */
  async connect(client: any): Promise<ReservationSessionResult | null> {
    const strings = this.constantsService.public;
    const query: any = client.handshake?.query ?? {};
    const auth: any = client.handshake?.auth ?? {};

    const hotelId = this.parseHotelId(query.hotelId ?? auth.hotelId);
    if (hotelId === null) {
      client.emit('error', { message: strings.ERROR_RESERVATION_HOTEL_REQUIRED });
      client.disconnect(true);
      return null;
    }

    try {
      const token = query.sessionToken ?? auth.sessionToken ?? null;
      const result = await this.startSession(hotelId, token ? String(token) : null);
      // Held until there is a chat to attach it to. A visitor who only looks at
      // the page never causes a write.
      client.reservationContext = { hotelId, publicHotel: result.publicHotel };
      if (result.chat) {
        client.session = this.buildSession(client, result.chat);
      }
      client.emit('ready', {
        chatId: result.chat ? result.chat.id : null,
        sessionToken: result.sessionToken,
        hotel: result.publicHotel,
        messages: result.messages,
      });
      return result;
    } catch (err: any) {
      const notFound = err?.status === 404 || err?.statusCode === 404;
      // Logged, because the caller only ever sees "we could not start the chat";
      // without this the reason for a dead line is recorded nowhere at all.
      if (!notFound) {
        this.logger.error({ error: err, serviceName: 'ReservationService', actionName: 'connect' });
      }
      client.emit('error', {
        message: notFound ? strings.ERROR_RESERVATION_HOTEL_NOT_FOUND : strings.ERROR_RESERVATION_SETUP_FAILED,
      });
      client.disconnect(true);
      return null;
    }
  }

  /**
   * The client's session, creating its chat on the first thing actually said, so
   * a visitor who opens the page and stays silent never writes anything. The
   * client gets the handle to resume it after a refresh.
   */
  async ensureSession(client: any): Promise<ChatSession> {
    if (!client.session) {
      const { chat, sessionToken } = await this.createChat(client.reservationContext.hotelId);
      client.session = this.buildSession(client, chat);
      client.emit('session', { chatId: chat.id, sessionToken });
    }
    return client.session;
  }

  /**
   * Resume the reservation conversation for a hotel, or report that there isn't
   * one yet. Deliberately does not create a chat: the page is public and
   * unauthenticated, so opening it must not write a row — otherwise anyone
   * could fill the table by reloading. createChat does that on first message.
   *
   * A token that does not verify, or points at another hotel's chat, is treated
   * as absent rather than an error; the visitor has done nothing wrong.
   */
  async startSession(hotelId: number, sessionToken?: string | null): Promise<ReservationSessionResult> {
    const hotel = await this.hotelsService.findById(hotelId);
    if (!hotel) {
      throw new NotFoundException(this.constantsService.public.ERROR_RESERVATION_HOTEL_NOT_FOUND);
    }

    const existingChatId = this.verifySessionToken(sessionToken);
    const chat = existingChatId ? await this.chatService.findReservationChat(existingChatId, hotelId) : null;
    const cfg = this.constantsService.private.RESERVATION;
    const messages = chat ? await this.messagesService.findRecentByChatId(chat.id, cfg.HISTORY_MESSAGE_LIMIT) : [];

    return {
      chat,
      hotel,
      publicHotel: toPublicHotel(hotel),
      sessionToken: chat ? this.issueSessionToken(chat.id) : null,
      messages,
    };
  }

  /** Create the chat backing a reservation conversation, with its signed handle. */
  async createChat(hotelId: number): Promise<{ chat: Chat; sessionToken: string }> {
    const chat = await this.chatService.createReservationChat(hotelId);
    return { chat, sessionToken: this.issueSessionToken(chat.id) };
  }

  /**
   * Reservation enquiries for a hotel, for the staff who have to act on them.
   * Ownership is checked by resolving the hotel as the caller, which 404s for a
   * hotel they are not a member of. The enquiry itself is the
   * record_reservation_enquiry tool call on an assistant message — no separate
   * table — so it is read back out of the conversation here.
   */
  async listEnquiriesForHotel(hotelId: number, account: Account) {
    await this.hotelsService.findByIdForAccount(hotelId, account);

    const cfg = this.constantsService.private.RESERVATION;
    const chats = await this.chatService.listReservationChatsForHotel(hotelId, cfg.STAFF_CHAT_LIST_LIMIT);
    const messages = await this.messagesService.findByChatIds(chats.map((chat) => chat.id));

    const byChat = new Map<number, Message[]>();
    for (const message of messages) {
      const bucket = byChat.get(message.chatId);
      if (bucket) {
        bucket.push(message);
      } else {
        byChat.set(message.chatId, [message]);
      }
    }

    const data = chats.map((chat) => {
      const chatMessages = byChat.get(chat.id) ?? [];
      const enquiries: Record<string, unknown>[] = [];
      // What the agent wrote down as it heard it beats what it recalls at the end,
      // which is reconstructed and often wrong. Accumulated field by field: notes
      // arrive through the call carrying whatever was just learned, so a name
      // noted early must survive a later note about the phone number.
      const noted: Record<string, unknown> = {};
      // What it wrote in its notebook beyond the booking — an occasion, a request.
      const asides: string[] = [];
      for (const message of chatMessages) {
        // createdAt comes from Sequelize timestamps, which the model does not declare.
        const messageRow: any = message;
        for (const call of message.toolCalls ?? []) {
          if (call.toolName === 'add_note' && typeof call.input?.content === 'string') {
            asides.push(call.input.content);
          }
          if (call.toolName === 'note_reservation_dates' && call.input) {
            for (const [field, value] of Object.entries(call.input)) {
              if (value !== undefined && value !== null && value !== '') {
                noted[field] = value;
              }
            }
          }
          if (call.toolName === 'record_reservation_enquiry' && call.input) {
            const enquiry: Record<string, unknown> = { ...call.input, ...noted };
            enquiry.guestName = unspell(enquiry.guestName, false);
            enquiry.guestEmail = unspell(enquiry.guestEmail, true);
            // An occasion is noted when it is mentioned, and often left out of the
            // final record; the staff card shows specialRequests, so it falls back.
            enquiry.specialRequests = enquiry.specialRequests || enquiry.occasion || asides.join(' ') || undefined;
            enquiries.push({ ...enquiry, recordedAt: messageRow.createdAt });
          }
        }
      }
      const lastMessage = chatMessages.length > 0 ? chatMessages[chatMessages.length - 1] : null;
      return {
        chatId: chat.id,
        createdAt: chat.createdAt,
        messageCount: chatMessages.length,
        enquiries,
        lastMessage: lastMessage ? { role: lastMessage.role, content: lastMessage.content } : null,
      };
    });

    return { success: true, message: this.constantsService.public.RESERVATION_ENQUIRIES_FETCHED, data };
  }

  /**
   * One conversation in full. Kept off the list response because fifty threads of
   * fifty messages is a payload nobody asked for.
   *
   * Ownership twice over: the hotel must resolve as this account, and the chat
   * must belong to that hotel and be a reservation chat.
   */
  async conversationForHotel(chatId: number, hotelId: number, account: Account) {
    await this.hotelsService.findByIdForAccount(hotelId, account);
    const chat = await this.chatService.findReservationChat(chatId, hotelId);
    if (!chat) {
      throw new NotFoundException(this.constantsService.public.ERROR_RESERVATION_CONVERSATION_NOT_FOUND);
    }

    const cfg = this.constantsService.private.RESERVATION;
    const messages = await this.messagesService.findRecentByChatId(chat.id, cfg.STAFF_CONVERSATION_MESSAGE_LIMIT);
    const data = messages.map((message) => {
      // createdAt comes from Sequelize timestamps, which the model does not declare.
      const row: any = message;
      return { id: message.id, role: message.role, content: message.content, createdAt: row.createdAt };
    });

    return { success: true, message: this.constantsService.public.RESERVATION_CONVERSATION_FETCHED, data };
  }

  /**
   * Keep the stored language on the one the agent actually answered in.
   *
   * Measured: a caller went from Hindi back to English, was answered in
   * English, and the agent never called set_chat_language — so the chat stayed
   * Hindi and a reconnect came back in it. Read off the reply, it cannot drift.
   */
  async followReplyLanguage(session: { chatId: number; languageCode?: string | null }, reply: string): Promise<void> {
    const cfg = this.constantsService.private.RESERVATION;
    const script = cfg.REPLY_SCRIPT_LANGUAGES.find((entry) => new RegExp(entry.pattern).test(reply));
    const languageCode = script ? script.languageCode : /[A-Za-z]/.test(reply) ? cfg.REPLY_LATIN_LANGUAGE : null;
    if (!languageCode || languageCode === session.languageCode) {
      return;
    }
    session.languageCode = languageCode;
    await this.chatService.updateLanguageCode(session.chatId, languageCode);
  }

  /**
   * Take one from a per-IP allowance held in the cache for the window. Returns
   * false once it is spent; a max of zero or less means no limit.
   */
  private takeFromAllowance(key: string, max: number): boolean {
    if (max <= 0) {
      return true;
    }
    const used = this.cacheService.get<number>(key) ?? 0;
    if (used >= max) {
      return false;
    }
    this.cacheService.set(key, used + 1, this.constantsService.private.RESERVATION.IP_WINDOW_MINUTES);
    return true;
  }

  /**
   * Per-IP voice turn budget. Held apart from the text budget because a voice
   * turn costs STT seconds plus LLM tokens plus TTS characters, so the two
   * surfaces cannot share one allowance.
   */
  isWithinVoiceTurnLimit(ip: string): boolean {
    const cfg = this.constantsService.private.RESERVATION_VOICE;
    return this.takeFromAllowance(cfg.IP_TURN_CACHE_KEY_PREFIX + ip, cfg.MAX_TURNS_PER_IP_PER_WINDOW);
  }

  /**
   * Claim one of an IP's concurrent voice slots. Returns false when they are all
   * taken, which stops a single visitor holding several microphones open.
   * The TTL means a slot leaked by a hard crash frees itself.
   */
  claimVoiceSession(ip: string): boolean {
    const cfg = this.constantsService.private.RESERVATION_VOICE;
    return this.takeFromAllowance(cfg.IP_SESSION_CACHE_KEY_PREFIX + ip, cfg.MAX_CONCURRENT_SESSIONS_PER_IP);
  }

  /** Give a concurrent voice slot back on disconnect. */
  releaseVoiceSession(ip: string): void {
    const cfg = this.constantsService.private.RESERVATION_VOICE;
    const key = cfg.IP_SESSION_CACHE_KEY_PREFIX + ip;
    const next = (this.cacheService.get<number>(key) ?? 0) - 1;
    if (next > 0) {
      this.cacheService.set(key, next, this.constantsService.private.RESERVATION.IP_WINDOW_MINUTES);
    } else {
      this.cacheService.delete(key);
    }
  }

  /**
   * Per-IP message budget across connections, so reconnecting does not hand a
   * visitor a fresh allowance on the one LLM surface that needs no login.
   */
  isWithinIpRateLimit(ip: string): boolean {
    const cfg = this.constantsService.private.RESERVATION;
    return this.takeFromAllowance(cfg.IP_RATE_LIMIT_CACHE_KEY_PREFIX + ip, cfg.MAX_MESSAGES_PER_IP_PER_WINDOW);
  }
}
