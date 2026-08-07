import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AccountsService } from '../accounts/accounts.service';
import { Account } from '../accounts/accounts.model';
import { HOTEL_MEMBER_INVITE_TYPE_STAFF, HotelMemberStatus } from '../common/constants/constants.service';
import { HotelAccount } from '../hotels/hotel-accounts.model';

@Controller('invite')
export class InviteController {
  constructor(
    private authService: AuthService,
    private accountsService: AccountsService,
  ) {}

  @Post()
  async exchangeInvite(@Body() body: { token?: string }) {
    const token = body && body.token ? body.token : null;
    if (!token) {
      throw new HttpException(
        {
          success: false,
          message: 'Invite token is required',
          data: null,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const decoded: any = await this.authService.verifyToken(token);
    if (!decoded || !decoded.invite) {
      throw new HttpException(
        {
          success: false,
          message: 'Invite link is invalid or has expired',
          data: null,
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const accountId = decoded.id;
    let account: Account | null = null;
    if (accountId) {
      account = await this.accountsService.findOne({
        where: { id: accountId },
      });
    }

    if (!account) {
      throw new HttpException(
        {
          success: false,
          message: 'Invite link is invalid or has expired',
          data: null,
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (decoded.type === HOTEL_MEMBER_INVITE_TYPE_STAFF && decoded.hotelId) {
      const hotelAccount = await HotelAccount.findOne({
        where: { hotelId: decoded.hotelId, accountId: account.id },
      });
      if (hotelAccount) {
        hotelAccount.status = HotelMemberStatus.ACTIVE;
        await hotelAccount.save();
      }
    }

    const standardToken = await this.authService.generateToken(account);

    return {
      success: true,
      token: standardToken,
      account: {
        id: account.id,
        uuid: account.uuid,
        email: account.email,
        name: account.name,
        role: account.role,
        profilePicUrl: account.profilePicUrl,
      },
    };
  }
}
