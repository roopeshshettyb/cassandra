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
import { CreateBookingDto, UpdateBookingDto, ReservationDocumentUploadUrlDto, ReservationDocumentKeyDto } from './bookings.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentAccount } from '../auth/decorators/account.decorator';
import { AdminOnly } from '../auth/decorators/admin.decorator';
import { Account } from '../accounts/accounts.model';
import { ListQuery } from '../common/filters/list-filters';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // The query is validated against the model's flagged columns, not a DTO — see list-filters.
  @Get()
  async findAll(@CurrentAccount() account: Account, @Query() query: ListQuery) {
    return this.bookingsService.findAllForAccount(account, query);
  }

  /** The filters this list offers, so the UI does not hardcode them. Declared before :id to match first. */
  @Get('filters')
  getFilters() {
    return this.bookingsService.getListFilterMeta();
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
