import { Controller, Get, Patch, Param, Body, UseGuards, Inject, ForbiddenException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NOTIFICATION_PREFERENCE_REPOSITORY } from './notification-preference.repository';
import { NotificationPreference } from './notification-preference.model';
import { CurrentAccount } from '../auth/decorators/account.decorator';
import { Account } from '../accounts/accounts.model';
import { Hotel } from '../hotels/hotels.model';
import { HotelAccount } from '../hotels/hotel-accounts.model';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private notificationsService: NotificationsService,
    @Inject(NOTIFICATION_PREFERENCE_REPOSITORY) private readonly preferenceRepository: typeof NotificationPreference,
    @Inject('HOTEL_ACCOUNTS_REPOSITORY') private readonly hotelAccountRepository: typeof HotelAccount,
  ) {}

  @Get('list')
  @UseGuards(JwtAuthGuard)
  async findAll(@CurrentAccount() account: Account) {
    return this.notificationsService.findByAccountId(account.id);
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  async markAsRead(@Param('id') id: string, @CurrentAccount() account: Account) {
    return this.notificationsService.update({ read: true }, { id: parseInt(id, 10), accountId: account.id });
  }

  @Get('preferences')
  @UseGuards(JwtAuthGuard)
  async getPreferences(@CurrentAccount() account: Account) {
    const hotelAccounts = await this.hotelAccountRepository.findAll({
      where: { accountId: account.id },
      include: [{ model: Hotel, as: 'hotel', attributes: ['id', 'name'] }],
    });
    const result = [];
    for (let i = 0; i < hotelAccounts.length; i++) {
      const ha: any = hotelAccounts[i];
      const hotel: any = ha.hotel;
      if (!hotel) continue;
      const pref = await this.preferenceRepository.findOne({ where: { accountId: account.id, hotelId: hotel.id } });
      result.push({ hotelId: hotel.id, hotelName: hotel.name, pushEnabled: pref ? pref.pushEnabled : true, emailEnabled: pref ? pref.emailEnabled : true });
    }
    return { success: true, message: null, data: result };
  }

  @Patch('preferences')
  @UseGuards(JwtAuthGuard)
  async updatePreference(
    @CurrentAccount() account: Account,
    @Body() body: { hotelId: number; pushEnabled?: boolean; emailEnabled?: boolean },
  ) {
    const hotelAccount = await this.hotelAccountRepository.findOne({ where: { accountId: account.id, hotelId: body.hotelId } });
    if (!hotelAccount) throw new ForbiddenException('Not associated with this hotel');
    const update: any = {};
    if (body.pushEnabled !== undefined) update.pushEnabled = body.pushEnabled;
    if (body.emailEnabled !== undefined) update.emailEnabled = body.emailEnabled;
    await this.preferenceRepository.upsert({ accountId: account.id, hotelId: body.hotelId, ...update });
    return { success: true, message: 'Preferences updated', data: null };
  }
}
