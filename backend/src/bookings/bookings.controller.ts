import { Body, Controller, Delete, Get, Param, Post, UseGuards, ValidationPipe, ParseIntPipe } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './bookings.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentAccount } from '../auth/decorators/account.decorator';
import { Account } from '../accounts/accounts.model';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  async findAll(@CurrentAccount() account: Account) {
    return this.bookingsService.findAllForAccount(account);
  }

  @Get('active')
  async findActive(@CurrentAccount() account: Account) {
    return this.bookingsService.findActiveForGuest(account);
  }

  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number, @CurrentAccount() account: Account) {
    return this.bookingsService.findByIdForAccount(id, account);
  }

  @Post()
  async create(@Body(ValidationPipe) dto: CreateBookingDto, @CurrentAccount() account: Account) {
    return this.bookingsService.createBooking(dto, account);
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number, @CurrentAccount() account: Account) {
    return this.bookingsService.deleteForAccount(id, account);
  }
}
