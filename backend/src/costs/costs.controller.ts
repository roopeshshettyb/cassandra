import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { CostsService } from './costs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentAccount } from '../auth/decorators/account.decorator';
import { Account } from '../accounts/accounts.model';

@Controller('costs')
@UseGuards(JwtAuthGuard)
export class CostsController {
  constructor(private readonly costsService: CostsService) {}

  @Get('by-booking/:bookingId')
  async findByBooking(@Param('bookingId', ParseIntPipe) bookingId: number) {
    return this.costsService.findByBookingId(bookingId);
  }

  @Get('by-hotel/:hotelId')
  async findByHotel(@Param('hotelId', ParseIntPipe) hotelId: number) {
    return this.costsService.findByHotelId(hotelId);
  }

  @Get('aggregate')
  async aggregate(@CurrentAccount() account: Account) {
    return this.costsService.aggregateCosts(account);
  }
}

