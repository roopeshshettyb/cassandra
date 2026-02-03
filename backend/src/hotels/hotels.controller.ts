import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { HotelsService } from './hotels.service';
import { CreateHotelDto, GrantHotelAccessDto, UpdateHotelDto } from './hotels.dto';
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
}
