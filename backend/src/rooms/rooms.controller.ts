import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, ValidationPipe, ParseIntPipe } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import {
  AvailabilityQueryDto,
  CreateRoomDto,
  CreateRoomTypeDto,
  InventoryQueryDto,
  UpdateInventoryDto,
  UpdateRoomDto,
  UpdateRoomTypeDto,
} from './rooms.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentAccount } from '../auth/decorators/account.decorator';
import { Account } from '../accounts/accounts.model';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  // Declared before the `:id` routes below, or `types` and `inventory` would be
  // parsed as a room id.
  @Get('types')
  async findAllRoomTypes(
    @Query('hotelId', ParseIntPipe) hotelId: number,
    @CurrentAccount() account: Account,
  ) {
    return this.roomsService.findAllRoomTypes(hotelId, account);
  }

  @Post('types')
  async createRoomType(
    @Body(ValidationPipe) dto: CreateRoomTypeDto,
    @CurrentAccount() account: Account,
  ) {
    return this.roomsService.createRoomType(dto, account);
  }

  @Patch('types/:id')
  async updateRoomType(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ skipMissingProperties: true })) dto: UpdateRoomTypeDto,
    @CurrentAccount() account: Account,
  ) {
    return this.roomsService.updateRoomType(id, dto, account);
  }

  @Delete('types/:id')
  async deleteRoomType(
    @Param('id', ParseIntPipe) id: number,
    @CurrentAccount() account: Account,
  ) {
    return this.roomsService.deleteRoomType(id, account);
  }

  @Get('inventory')
  async findInventory(
    @Query(ValidationPipe) query: InventoryQueryDto,
    @CurrentAccount() account: Account,
  ) {
    return this.roomsService.findInventory(query, account);
  }

  @Patch('inventory')
  async updateInventory(
    @Body(new ValidationPipe({ skipMissingProperties: true })) dto: UpdateInventoryDto,
    @CurrentAccount() account: Account,
  ) {
    return this.roomsService.updateInventory(dto, account);
  }

  @Get('availability')
  async findAvailability(
    @Query(ValidationPipe) query: AvailabilityQueryDto,
    @CurrentAccount() account: Account,
  ) {
    return this.roomsService.findAvailability(query, account);
  }

  @Get()
  async findAllRooms(
    @Query('hotelId', ParseIntPipe) hotelId: number,
    @Query('roomTypeId') roomTypeId: string,
    @CurrentAccount() account: Account,
  ) {
    // Optional, so ParseIntPipe would reject the common case of it being absent.
    // Parsed by hand instead, and anything non-numeric is treated as no filter —
    // passing NaN straight through would reach Postgres and fail the request.
    const parsed = Number(roomTypeId);
    const filterRoomTypeId = Number.isInteger(parsed) ? parsed : undefined;
    return this.roomsService.findAllRooms(hotelId, filterRoomTypeId, account);
  }

  @Post()
  async createRoom(
    @Body(ValidationPipe) dto: CreateRoomDto,
    @CurrentAccount() account: Account,
  ) {
    return this.roomsService.createRoom(dto, account);
  }

  @Patch(':id')
  async updateRoom(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ skipMissingProperties: true })) dto: UpdateRoomDto,
    @CurrentAccount() account: Account,
  ) {
    return this.roomsService.updateRoom(id, dto, account);
  }

  @Delete(':id')
  async deleteRoom(
    @Param('id', ParseIntPipe) id: number,
    @CurrentAccount() account: Account,
  ) {
    return this.roomsService.deleteRoom(id, account);
  }
}
