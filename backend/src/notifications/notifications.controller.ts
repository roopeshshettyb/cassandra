import { Controller, Get, Patch, Delete, Param, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentAccount } from '../auth/decorators/account.decorator';
import { Account } from '../accounts/accounts.model';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

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

  @Delete('clear')
  @UseGuards(JwtAuthGuard)
  async clearAll(@CurrentAccount() account: Account) {
    const deletedCount = await this.notificationsService.delete({ accountId: account.id });
    return {
      success: true,
      message: `Cleared ${deletedCount} notifications`,
      deletedCount,
    };
  }
}
