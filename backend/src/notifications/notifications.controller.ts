import { Controller, Get, Patch, Param, Body, UseGuards, Inject } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NOTIFICATION_PREFERENCE_REPOSITORY } from './notification-preference.repository';
import { NotificationPreference } from './notification-preference.model';
import { CurrentAccount } from '../auth/decorators/account.decorator';
import { Account } from '../accounts/accounts.model';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConstantsService } from '../common/constants/constants.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private notificationsService: NotificationsService,
    @Inject(NOTIFICATION_PREFERENCE_REPOSITORY) private readonly preferenceRepository: typeof NotificationPreference,
    private constants: ConstantsService,
  ) {}

  @Get('list')
  @UseGuards(JwtAuthGuard)
  async findAll(@CurrentAccount() account: Account) {
    const data = await this.notificationsService.findByAccountId(account.id);
    return { success: true, message: this.constants.public.NOTIFICATIONS_FETCHED, data };
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  async markAsRead(@Param('id') id: string, @CurrentAccount() account: Account) {
    return this.notificationsService.update({ read: true }, { id: parseInt(id, 10), accountId: account.id });
  }

  @Get('preferences')
  @UseGuards(JwtAuthGuard)
  async getPreferences(@CurrentAccount() account: Account) {
    const pref = await this.preferenceRepository.findOne({ where: { accountId: account.id } });
    return {
      success: true,
      message: this.constants.public.PREFERENCES_FETCHED,
      data: {
        pushEnabled: pref ? pref.pushEnabled : true,
        emailEnabled: pref ? pref.emailEnabled : true,
      },
    };
  }

  @Patch('preferences')
  @UseGuards(JwtAuthGuard)
  async updatePreference(
    @CurrentAccount() account: Account,
    @Body() body: { pushEnabled?: boolean; emailEnabled?: boolean },
  ) {
    const update: any = {};
    if (body.pushEnabled !== undefined) update.pushEnabled = body.pushEnabled;
    if (body.emailEnabled !== undefined) update.emailEnabled = body.emailEnabled;
    await this.preferenceRepository.upsert({ accountId: account.id, ...update });
    return { success: true, message: this.constants.public.PREFERENCES_UPDATED, data: null };
  }
}
