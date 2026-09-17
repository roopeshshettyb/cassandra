import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto, UpdateBookingDto, ReservationDocumentUploadUrlDto, ReservationDocumentKeyDto, ListBookingsQueryDto } from './bookings.dto';
import { LIST_QUERY_PIPE_OPTIONS } from '../common/dto/list-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentAccount } from '../auth/decorators/account.decorator';
import { AdminOnly } from '../auth/decorators/admin.decorator';
import { Account } from '../accounts/accounts.model';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // No global validation pipe in this app, so the query DTO is validated per handler.
  @Get()
  async findAll(
    @CurrentAccount() account: Account,
    @Query(new ValidationPipe(LIST_QUERY_PIPE_OPTIONS)) query: ListBookingsQueryDto,
  ) {
    return this.bookingsService.findForAccountWithOptions(account, query);
  }

  @Get('active')
  async findActive(@CurrentAccount() account: Account) {
    return this.bookingsService.findActiveForGuest(account);
  }

  @Post('send-pending-invites')
  @AdminOnly()
  async sendPendingInvites() {
    await this.bookingsService.sendPendingInviteEmails();
    return { success: true, message: 'Pending invite emails sent', data: null };
  }

  @Post('reservation-document-upload-url')
  async getReservationDocumentUploadUrl(
    @Body(ValidationPipe) dto: ReservationDocumentUploadUrlDto,
    @CurrentAccount() account: Account,
  ) {
    return this.bookingsService.getReservationDocumentUploadUrl(account, dto.contentType, dto.filename);
  }

  @Post('extract-from-reservation-document')
  async extractFromReservationDocument(
    @Body(ValidationPipe) dto: ReservationDocumentKeyDto,
    @CurrentAccount() account: Account,
  ) {
    return this.bookingsService.extractFromReservationDocumentByKey(dto.key, account);
  }

  @Post('from-reservation-document')
  async createFromReservationDocument(
    @Body(ValidationPipe) dto: ReservationDocumentKeyDto,
    @CurrentAccount() account: Account,
  ) {
    return this.bookingsService.createFromReservationDocumentByKey(dto.key, account);
  }

  @Get(':id/reservation-document-url')
  async getReservationDocumentUrl(@Param('id', ParseIntPipe) id: number, @CurrentAccount() account: Account) {
    return this.bookingsService.getReservationDocumentViewUrl(id, account);
  }

  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number, @CurrentAccount() account: Account) {
    return this.bookingsService.findByIdForAccount(id, account);
  }

  @Post()
  async create(@Body(ValidationPipe) dto: CreateBookingDto, @CurrentAccount() account: Account) {
    return this.bookingsService.createBooking(dto, account);
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body(ValidationPipe) dto: UpdateBookingDto, @CurrentAccount() account: Account) {
    return this.bookingsService.updateForAccount(id, dto, account);
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number, @CurrentAccount() account: Account) {
    return this.bookingsService.deleteForAccount(id, account);
  }
}
