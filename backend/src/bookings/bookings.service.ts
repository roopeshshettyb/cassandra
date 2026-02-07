import { Inject, Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { BOOKINGS_REPOSITORY } from './bookings.repository';
import { Booking } from './bookings.model';
import { CreateBookingDto } from './bookings.dto';
import { Account, AccountRole } from '../accounts/accounts.model';
import { AccountsService } from '../accounts/accounts.service';
import { AuthService } from '../auth/auth.service';
import { HotelsService } from '../hotels/hotels.service';
import { Hotel } from '../hotels/hotels.model';
import { MailerService } from '../mailer/mailer.service';
import { ConstantsService } from '../common/constants/constants.service';
import { Op } from 'sequelize';
import { Chat } from '../chat/chat.model';
import { Request } from '../requests/requests.model';
import { Message } from '../messages/message.model';

@Injectable()
export class BookingsService {
  constructor(
    @Inject(BOOKINGS_REPOSITORY) private readonly bookingsRepository: typeof Booking,
    private readonly accountsService: AccountsService,
    private readonly authService: AuthService,
    private readonly hotelsService: HotelsService,
    private readonly mailerService: MailerService,
    private readonly constantsService: ConstantsService,
  ) {}

  private parseDateTime(dateStr: string, timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, hours, minutes, 0, 0);
  }

  private async ensureCanCreateForHotel(hotelId: number, currentAccount: Account): Promise<Hotel> {
    const hotel = await this.hotelsService.findByIdForAccount(hotelId, currentAccount);
    if (!hotel) {
      throw new NotFoundException();
    }
    if (currentAccount.role !== AccountRole.ADMIN && currentAccount.role !== AccountRole.HOTEL_OWNER && currentAccount.role !== AccountRole.HOTEL_STAFF) {
      throw new ForbiddenException();
    }
    return hotel;
  }

  async createBooking(dto: CreateBookingDto, currentAccount: Account) {
    const hotel = await this.ensureCanCreateForHotel(dto.hotelId, currentAccount);

    const startDate = dto.startDate.trim();
    const endDate = dto.endDate.trim();
    if (endDate < startDate) {
      throw new BadRequestException('endDate must be on or after startDate');
    }

    const checkInTime = hotel.checkInTime || '15:00';
    const checkOutTime = hotel.checkOutTime || '11:00';

    const normalizedEmail = dto.guestEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestException('Guest email is required');
    }

    let guest = await this.accountsService.findOne({
      where: { email: normalizedEmail },
    });

    if (!guest) {
      const uuid = `email:${normalizedEmail}`;
      const [createdAccount] = await this.accountsService.upsert({
        uuid,
        email: normalizedEmail,
        name: dto.guestName,
        oauthMeta: {},
        role: AccountRole.GUEST,
      });
      guest = createdAccount;
    }

    const startTime = this.parseDateTime(startDate, checkInTime);
    const endTime = this.parseDateTime(endDate, checkOutTime);

    const booking = await this.bookingsRepository.create({
      guestId: guest.id,
      hotelId: hotel.id,
      startTime,
      endTime,
    });

    const inviteToken = await this.authService.generateInviteToken(guest, {
      bookingId: booking.id,
      hotelId: hotel.id,
      type: 'guest',
    });
    const frontendUrl = this.constantsService.private.FRONTEND_URL;
    const inviteUrl = `${frontendUrl}/invite?token=${encodeURIComponent(inviteToken)}`;

    await this.sendBookingConfirmationEmail(guest.email, guest.name, hotel, inviteUrl);

    return {
      success: true,
      message: 'Booking created',
      data: booking,
    };
  }

  private async sendBookingConfirmationEmail(toEmail: string, guestName: string | null, hotel: Hotel, inviteUrl: string): Promise<void> {
    if (!toEmail) {
      return;
    }

    const pub = this.constantsService.public;
    const appName = pub.APP_NAME;
    const subject = `Your booking is confirmed - open ${appName} to help with your stay`;

    const greeting = guestName ? `Hi ${guestName},` : 'Hi,';
    const cta = 'Start talking with Samantha by clicking here';
    const text = `${greeting}\n\nYour booking at ${hotel.name} is confirmed.\n\n${cta}\n\n${inviteUrl}`;
    const contentHtml = `<p>${greeting}</p><p>Your booking at <strong>${hotel.name}</strong> is confirmed.</p><p>Start talking with Samantha by clicking <a href="${inviteUrl}">here</a>.</p>`;
    const html = this.mailerService.buildBaseEmailHtml(contentHtml);

    await this.mailerService.sendMail({
      to: toEmail,
      subject,
      text,
      html,
    });
  }

  private async getWhereForAccount(currentAccount: Account): Promise<{ [key: string]: any } | null> {
    if (currentAccount.role === AccountRole.ADMIN) {
      return null;
    }
    if (currentAccount.role === AccountRole.GUEST) {
      return { guestId: currentAccount.id };
    }
    if (currentAccount.role === AccountRole.HOTEL_OWNER || currentAccount.role === AccountRole.HOTEL_STAFF) {
      const { data: hotels } = await this.hotelsService.findAllForAccount(currentAccount);
      const hotelIds = hotels.map((h) => h.id);
      if (hotelIds.length === 0) {
        return { hotelId: -1 };
      }
      return { hotelId: { [Op.in]: hotelIds } };
    }
    return { id: -1 };
  }

  async findAllForAccount(currentAccount: Account) {
    const includeHotel = { model: Hotel, as: 'hotel', attributes: ['id', 'name', 'address'] };
    const where = await this.getWhereForAccount(currentAccount);
    const options: any = { include: [includeHotel] };
    if (where) {
      options.where = where;
    }
    const bookings = await this.bookingsRepository.findAll(options);
    return { success: true, message: null, data: bookings };
  }

  async findByIdForAccount(id: number, currentAccount: Account) {
    const where = await this.getWhereForAccount(currentAccount);
    const findWhere = where ? { ...where, id } : { id };
    const booking = await this.bookingsRepository.findOne({
      where: findWhere,
      include: [
        { model: Hotel, as: 'hotel' },
        {
          model: Request,
          as: 'requests',
          attributes: ['id', 'requestType', 'urgency', 'status', 'userNotes', 'staffNotes'],
        },
      ],
      order: [
        [{ model: Request, as: 'requests' }, 'createdAt', 'DESC'],
        [{ model: Request, as: 'requests' }, 'urgency', 'DESC'],
      ],
    });

    if (!booking) {
      throw new NotFoundException();
    }

    return { success: true, message: null, data: booking };
  }

  async deleteForAccount(id: number, currentAccount: Account) {
    const where = await this.getWhereForAccount(currentAccount);
    const findWhere = where ? { ...where, id } : { id };
    const booking = await this.bookingsRepository.findOne({ where: findWhere });

    if (!booking) {
      throw new NotFoundException();
    }

    // Clean up dependent records that reference this booking to satisfy
    // database foreign key constraints (e.g. chats_booking_id_fkey, messages_chat_id_fkey).
    await Request.destroy({ where: { bookingId: id } });

    const chats = await Chat.findAll({ where: { bookingId: id } });
    if (chats.length > 0) {
      const chatIds = chats.map((c) => c.id);
      await Message.destroy({ where: { chatId: { [Op.in]: chatIds } } });
      await Chat.destroy({ where: { id: { [Op.in]: chatIds } } });
    }

    await this.bookingsRepository.destroy({ where: { id } });
    return { success: true, message: 'Booking deleted', data: null };
  }
}
