import { Controller, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentAccount } from '../auth/decorators/account.decorator';
import { Account } from '../accounts/accounts.model';

/**
 * Staff-side view of the reservation agent's work. The agent itself is
 * unauthenticated and lives on the /reservation socket namespace; reading the
 * enquiries it gathered requires membership of the hotel.
 */
@Controller('reservation')
@UseGuards(JwtAuthGuard)
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  @Get('enquiries')
  async listEnquiries(
    @Query('hotelId', ParseIntPipe) hotelId: number,
    @CurrentAccount() account: Account,
  ) {
    return this.reservationService.listEnquiriesForHotel(hotelId, account);
  }
}
