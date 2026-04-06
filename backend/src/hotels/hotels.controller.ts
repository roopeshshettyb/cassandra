import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { HotelsService } from './hotels.service';
import { AddHotelStaffDto, CreateHotelDto, GrantHotelAccessDto, UpdateHotelDto } from './hotels.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentAccount } from '../auth/decorators/account.decorator';
import { AdminOnly } from '../auth/decorators/admin.decorator';
import { Account } from '../accounts/accounts.model';

@Controller('hotels')
@UseGuards(JwtAuthGuard)
export class HotelsController {
  constructor(private readonly hotelsService: HotelsService) {}

  @Get()
  async findAll(@CurrentAccount() account: Account) {
    return this.hotelsService.findAllForAccount(account);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @CurrentAccount() account: Account) {
    return this.hotelsService.findByIdForAccount(Number(id), account);
  }

  @Post()
  @AdminOnly()
  async create(@Body(ValidationPipe) createHotelDto: CreateHotelDto, @CurrentAccount() account: Account) {
    return this.hotelsService.createHotel(createHotelDto, account);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body(ValidationPipe) updateHotelDto: UpdateHotelDto, @CurrentAccount() account: Account) {
    return this.hotelsService.updateHotel(Number(id), updateHotelDto, account);
  }

  @Delete(':id')
  @AdminOnly()
  async delete(@Param('id') id: string, @CurrentAccount() account: Account) {
    await this.hotelsService.deleteHotel(Number(id), account);
    return { success: true, message: 'Hotel deleted', data: null };
  }

  @Get(':id/staff')
  async listStaff(@Param('id') id: string, @CurrentAccount() account: Account) {
    const staff = await this.hotelsService.listStaffForHotel(Number(id), account);
    return {
      success: true,
      message: null,
      data: staff,
    };
  }

  @Post(':id/staff')
  async addStaff(@Param('id') id: string, @Body(ValidationPipe) body: AddHotelStaffDto, @CurrentAccount() account: Account) {
    const staff = await this.hotelsService.addStaffByEmail(Number(id), body, account);
    return {
      success: true,
      message: 'Staff access granted',
      data: staff,
    };
  }

  @Delete(':id/staff/:accountId')
  async revokeStaff(@Param('id') id: string, @Param('accountId') accountId: string, @CurrentAccount() account: Account) {
    await this.hotelsService.revokeStaffAccess(Number(id), Number(accountId), account);
    return {
      success: true,
      message: 'Access revoked',
      data: null,
    };
  }

  @Post(':id/access')
  @AdminOnly()
  async grantAccess(@Param('id') id: string, @Body(ValidationPipe) body: GrantHotelAccessDto, @CurrentAccount() account: Account) {
    return this.hotelsService.grantAccess(Number(id), body);
  }

  @Delete(':id/access/:accountId')
  @AdminOnly()
  async revokeAccess(@Param('id') id: string, @Param('accountId') accountId: string, @CurrentAccount() account: Account) {
    await this.hotelsService.revokeAccess(Number(id), Number(accountId));
    return { success: true };
  }

  @Post(':id/logo/presigned-url')
  async getLogoPresignedUrl(
    @Param('id') id: string,
    @Body() body: { fileName: string; fileSize: number; contentType: string },
    @CurrentAccount() account: Account,
  ) {
    return this.hotelsService.getLogoPresignedUrl(Number(id), body, account);
  }

  @Patch(':id/logo')
  async confirmLogoUpload(
    @Param('id') id: string,
    @Body() body: { s3Url: string },
    @CurrentAccount() account: Account,
  ) {
    return this.hotelsService.confirmLogoUpload(Number(id), body, account);
  }

  @Post(':id/notification-tone/presigned-url')
  async getNotificationTonePresignedUrl(
    @Param('id') id: string,
    @Body() body: { fileName: string; fileSize: number; contentType: string },
    @CurrentAccount() account: Account,
  ) {
    return this.hotelsService.getNotificationTonePresignedUrl(Number(id), body, account);
  }

  @Patch(':id/notification-tone')
  async confirmNotificationToneUpload(
    @Param('id') id: string,
    @Body() body: { s3Url: string },
    @CurrentAccount() account: Account,
  ) {
    return this.hotelsService.confirmNotificationToneUpload(Number(id), body, account);
  }

  @Get(':id/notification-tone/signed-url')
  async getNotificationToneSignedUrl(@Param('id') id: string, @CurrentAccount() account: Account) {
    return this.hotelsService.getNotificationToneSignedUrl(Number(id), account);
  }
}
