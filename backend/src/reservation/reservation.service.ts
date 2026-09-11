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

export interface ReservationSessionResult {
  /** Null until the visitor actually says something — see startSession. */
  chat: Chat | null;
  hotel: Hotel;
  publicHotel: Record<string, unknown> | null;
  sessionToken: string | null;
  messages: Message[];
}

@Injectable()
export class ReservationService {
  constructor(
    private readonly chatService: ChatService,
    private readonly hotelsService: HotelsService,
    private readonly messagesService: MessagesService,
    private readonly cacheService: CacheService,
    private readonly constantsService: ConstantsService,
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
      for (const message of chatMessages) {
        // createdAt comes from Sequelize timestamps, which the model does not declare.
        const messageRow: any = message;
        for (const call of message.toolCalls ?? []) {
          if (call.toolName === 'record_reservation_enquiry' && call.input) {
            enquiries.push({ ...call.input, recordedAt: messageRow.createdAt });
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
   * Per-IP voice turn budget. Held apart from the text budget because a voice
   * turn costs STT seconds plus LLM tokens plus TTS characters, so the two
   * surfaces cannot share one allowance.
   */
  isWithinVoiceTurnLimit(ip: string): boolean {
    const cfg = this.constantsService.private.RESERVATION_VOICE;
    const key = cfg.IP_TURN_CACHE_KEY_PREFIX + ip;
    const used = this.cacheService.get<number>(key) ?? 0;
    if (used >= cfg.MAX_TURNS_PER_IP_PER_WINDOW) {
      return false;
    }
    this.cacheService.set(key, used + 1, cfg.IP_WINDOW_MINUTES);
    return true;
  }

  /**
   * Claim one of an IP's concurrent voice slots. Returns false when they are all
   * taken, which stops a single visitor holding several microphones open.
   * The TTL means a slot leaked by a hard crash frees itself.
   */
  claimVoiceSession(ip: string): boolean {
    const cfg = this.constantsService.private.RESERVATION_VOICE;
    const key = cfg.IP_SESSION_CACHE_KEY_PREFIX + ip;
    const open = this.cacheService.get<number>(key) ?? 0;
    if (open >= cfg.MAX_CONCURRENT_SESSIONS_PER_IP) {
      return false;
    }
    this.cacheService.set(key, open + 1, cfg.IP_WINDOW_MINUTES);
    return true;
  }

  /** Give a concurrent voice slot back on disconnect. */
  releaseVoiceSession(ip: string): void {
    const cfg = this.constantsService.private.RESERVATION_VOICE;
    const key = cfg.IP_SESSION_CACHE_KEY_PREFIX + ip;
    const open = this.cacheService.get<number>(key) ?? 0;
    const next = open - 1;
    if (next > 0) {
      this.cacheService.set(key, next, cfg.IP_WINDOW_MINUTES);
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
    const key = cfg.IP_RATE_LIMIT_CACHE_KEY_PREFIX + ip;
    const used = this.cacheService.get<number>(key) ?? 0;
    if (used >= cfg.MAX_MESSAGES_PER_IP_PER_WINDOW) {
      return false;
    }
    this.cacheService.set(key, used + 1, cfg.IP_WINDOW_MINUTES);
    return true;
  }
}
