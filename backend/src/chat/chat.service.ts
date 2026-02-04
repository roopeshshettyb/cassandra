import { Inject, Injectable } from '@nestjs/common';
import { CHAT_REPOSITORY } from './chat.repository';
import { Chat } from './chat.model';
import { Account } from '../accounts/accounts.model';
import { BookingsService } from '../bookings/bookings.service';

@Injectable()
export class ChatService {
  constructor(
    @Inject(CHAT_REPOSITORY) private readonly chatRepository: typeof Chat,
    private readonly bookingsService: BookingsService,
  ) {}

  async getMostRecentChatForBooking(bookingId: number): Promise<Chat | null> {
    return this.chatRepository.findOne({
      where: { bookingId },
      order: [['createdAt', 'DESC']],
    });
  }

  async findOrCreateForBooking(bookingId: number, account: Account): Promise<Chat> {
    await this.bookingsService.findByIdForAccount(bookingId, account);
    const existing = await this.getMostRecentChatForBooking(bookingId);
    if (existing) {
      return existing;
    }
    return this.chatRepository.create({ accountId: account.id, bookingId });
  }
}
