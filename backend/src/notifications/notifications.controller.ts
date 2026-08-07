import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentAccount } from '../auth/decorators/account.decorator';
import { Account } from '../accounts/accounts.model';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConstantsService } from '../common/constants/constants.service';
import { RegisterDeviceDto } from './notifications.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private notificationsService: NotificationsService,
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

  @Post('register-device')
  @UseGuards(JwtAuthGuard)
  async registerDevice(@CurrentAccount() account: Account, @Body() body: RegisterDeviceDto) {
    await this.notificationsService.registerDevice(account.id, body.token);
    return { success: true, message: null, data: null };
  }

  @Get('preferences')
  @UseGuards(JwtAuthGuard)
  async getPreferences(@CurrentAccount() account: Account) {
    const data = await this.notificationsService.getPreferences(account.id);
    return {
      success: true,
      message: this.constants.public.PREFERENCES_FETCHED,
      data,
    };
  }

  @Patch('preferences')
  @UseGuards(JwtAuthGuard)
  async updatePreference(
    @CurrentAccount() account: Account,
    @Body() body: { pushEnabled?: boolean; emailEnabled?: boolean },
  ) {
    await this.notificationsService.updatePreferences(account.id, body);
    return { success: true, message: this.constants.public.PREFERENCES_UPDATED, data: null };
  }
}
