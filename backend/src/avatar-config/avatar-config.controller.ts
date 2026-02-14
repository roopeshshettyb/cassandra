import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { AvatarConfigService } from './avatar-config.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentAccount } from '../auth/decorators/account.decorator';
import { Account } from '../accounts/accounts.model';

@Controller('avatar-config')
@UseGuards(JwtAuthGuard)
export class AvatarConfigController {
    constructor(private readonly avatarConfigService: AvatarConfigService) { }

    @Get(':bookingId')
    async getConfig(
        @Param('bookingId', ParseIntPipe) bookingId: number,
        @CurrentAccount() account: Account,
    ) {
        return this.avatarConfigService.getConfigForBooking(bookingId, account);
    }
}
