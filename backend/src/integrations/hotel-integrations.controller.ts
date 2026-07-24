import { Controller, Get, Post, Delete, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { HotelIntegrationsService } from './hotel-integrations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentAccount } from '../auth/decorators/account.decorator';
import { Account } from '../accounts/accounts.model';

// Session-JWT-authenticated hotel-management routes for the integration token
// lifecycle. Distinct from the Bearer-integration-token webhook routes in
// integrations.webhook.controller.ts.
@Controller('hotels/:hotelId/integrations')
@UseGuards(JwtAuthGuard)
export class HotelIntegrationsController {
  constructor(private readonly hotelIntegrationsService: HotelIntegrationsService) {}

  @Get()
  async getMetadata(@Param('hotelId', ParseIntPipe) hotelId: number, @CurrentAccount() account: Account) {
    return this.hotelIntegrationsService.getMetadataForHotel(hotelId, account);
  }

  @Post('token')
  async generateOrRotateToken(@Param('hotelId', ParseIntPipe) hotelId: number, @CurrentAccount() account: Account) {
    return this.hotelIntegrationsService.generateOrRotateToken(hotelId, account);
  }

  @Delete('token')
  async revokeToken(@Param('hotelId', ParseIntPipe) hotelId: number, @CurrentAccount() account: Account) {
    return this.hotelIntegrationsService.revokeToken(hotelId, account);
  }
}
