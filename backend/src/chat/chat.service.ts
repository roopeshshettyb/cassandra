import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { CHAT_REPOSITORY } from './chat.repository';
import { Chat, ChatType } from './chat.model';
import { Account } from '../accounts/accounts.model';
import { BookingsService } from '../bookings/bookings.service';

@Injectable()
export class ChatService {
  constructor(
    @Inject(CHAT_REPOSITORY) private readonly chatRepository: typeof Chat,
    @Inject(forwardRef(() => BookingsService)) private readonly bookingsService: BookingsService,
  ) {}

  async getMostRecentChatForBooking(bookingId: number): Promise<Chat | null> {
    return this.chatRepository.findOne({
      where: { bookingId },
      order: [['createdAt', 'DESC']],
    });
  }

  async getMostRecentGeneralChatForAccount(accountId: number): Promise<Chat | null> {
    return this.chatRepository.findOne({
      where: { accountId, bookingId: null },
      order: [['createdAt', 'DESC']],
    });
  }

  async findOrCreateGeneralForAccount(account: Account): Promise<Chat> {
    const existing = await this.getMostRecentGeneralChatForAccount(account.id);
    if (existing) {
      return existing;
    }
    return this.chatRepository.create({
      accountId: account.id,
      bookingId: null,
      chatType: ChatType.GENERAL,
    });
  }

  async findOrCreateForBooking(bookingId: number, account: Account): Promise<Chat> {
    await this.bookingsService.findByIdForAccount(bookingId, account);
    const existing = await this.getMostRecentChatForBooking(bookingId);
    if (existing) {
      return existing;
    }
    return this.chatRepository.create({ accountId: account.id, bookingId, chatType: ChatType.BOOKING });
  }

  /** Anonymous, hotel-scoped chat backing the public reservation agent. */
  async createReservationChat(hotelId: number): Promise<Chat> {
    return this.chatRepository.create({
      accountId: null,
      bookingId: null,
      hotelId,
      chatType: ChatType.RESERVATION,
    });
  }

  /**
   * Resume an anonymous reservation chat. Scoped by hotel and type so a guessed
   * or replayed id can never reach a booking or general chat.
   */
  async findReservationChat(chatId: number, hotelId: number): Promise<Chat | null> {
    return this.chatRepository.findOne({
      where: { id: chatId, hotelId, chatType: ChatType.RESERVATION },
    });
  }

  /** Reservation enquiries for a hotel, newest first — the staff-side view of them. */
  async listReservationChatsForHotel(hotelId: number, limit: number): Promise<Chat[]> {
    return this.chatRepository.findAll({
      where: { hotelId, chatType: ChatType.RESERVATION },
      order: [['createdAt', 'DESC']],
      limit,
    });
  }

  async createForAccount(account: Account): Promise<Chat> {
    return this.chatRepository.create({
      accountId: account.id,
      bookingId: null,
      chatType: ChatType.GENERAL,
    });
  }

  async setBookingForChat(chatId: number, bookingId: number | null, account: Account): Promise<Chat> {
    const chat = await this.chatRepository.findByPk(chatId);
    if (!chat || chat.accountId !== account.id) {
      throw new Error('Chat not found');
    }
    if (bookingId !== null) {
      await this.bookingsService.findByIdForAccount(bookingId, account);
    }
    chat.bookingId = bookingId;
    chat.chatType = bookingId === null ? ChatType.GENERAL : ChatType.BOOKING;
    await chat.save();
    return chat;
  }

  async listHistoryForSession(account: Account, bookingId: number | null): Promise<Chat[]> {
    const where: any = { accountId: account.id };
    if (bookingId === null) {
      where.bookingId = null;
    } else {
      await this.bookingsService.findByIdForAccount(bookingId, account);
      where.bookingId = bookingId;
    }

    return this.chatRepository.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: 30,
    });
  }

  async createNewForSession(account: Account, bookingId: number | null): Promise<Chat> {
    if (bookingId === null) {
      return this.chatRepository.create({
        accountId: account.id,
        bookingId: null,
        chatType: ChatType.GENERAL,
      });
    }
    await this.bookingsService.findByIdForAccount(bookingId, account);
    return this.chatRepository.create({
      accountId: account.id,
      bookingId,
      chatType: ChatType.BOOKING,
    });
  }

  async findByIdForSessionScope(account: Account, chatId: number, bookingId: number | null): Promise<Chat | null> {
    const where: any = { id: chatId, accountId: account.id };
    if (bookingId === null) {
      where.bookingId = null;
    } else {
      where.bookingId = bookingId;
    }
    return this.chatRepository.findOne({ where });
  }

  async findByIdForAccount(account: Account, chatId: number): Promise<Chat | null> {
    return this.chatRepository.findOne({
      where: { id: chatId, accountId: account.id },
    });
  }

  async updateChatName(chatId: number, chatName: string, account: Account): Promise<Chat> {
    const chat = await this.findByIdForAccount(account, chatId);
    if (!chat) {
      throw new Error('Chat not found');
    }
    chat.chatName = chatName;
    await chat.save();
    return chat;
  }

  async updateLanguageCode(chatId: number, languageCode: string | null): Promise<Chat> {
    const chat = await this.chatRepository.findByPk(chatId);
    if (!chat) {
      throw new Error(`Chat not found for id: ${chatId}`);
    }
    chat.languageCode = languageCode;
    await chat.save();
    return chat;
  }
}
