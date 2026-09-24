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
  RoomTypeImageUploadUrlDto,
  RoomTypeImageDto,
  NextRoomQueryDto,
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

  // `whitelist` on both: the service hands the DTO straight to Sequelize, so any
  // property left in it reaches a column. Without it, a body could carry `images`
  // and skip the cap enforced in addImage, or carry `hotelId` and move the room
  // type to a hotel the caller does not own.
  @Post('types')
  async createRoomType(
    @Body(new ValidationPipe({ whitelist: true })) dto: CreateRoomTypeDto,
    @CurrentAccount() account: Account,
  ) {
    return this.roomsService.createRoomType(dto, account);
  }

  @Patch('types/:id')
  async updateRoomType(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ skipMissingProperties: true, whitelist: true })) dto: UpdateRoomTypeDto,
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

  @Post('types/:id/images/presigned-url')
  async getImageUploadUrl(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) dto: RoomTypeImageUploadUrlDto,
    @CurrentAccount() account: Account,
  ) {
    return this.roomsService.getImageUploadUrl(id, dto, account);
  }

  @Post('types/:id/images')
  async addImage(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) dto: RoomTypeImageDto,
    @CurrentAccount() account: Account,
  ) {
    return this.roomsService.addImage(id, dto, account);
  }

  @Delete('types/:id/images')
  async removeImage(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) dto: RoomTypeImageDto,
    @CurrentAccount() account: Account,
  ) {
    return this.roomsService.removeImage(id, dto, account);
  }

  @Get('next-room')
  async findNextRoom(
    // `transform` so the ids arrive as the numbers the DTO declares. Query params are
    // strings, and this handler compares them against a model's id with `!==`.
    @Query(new ValidationPipe({ transform: true })) query: NextRoomQueryDto,
    @CurrentAccount() account: Account,
  ) {
    return this.roomsService.findNextRoom(query, account);
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

  // Whitelisted for the same reason as the room type routes above. It matters more
  // now that rooms back dated inventory: a body carrying `roomTypeId` would move a
  // room to another type and leave the two types' counts disagreeing with reality.
  @Post()
  async createRoom(
    @Body(new ValidationPipe({ whitelist: true })) dto: CreateRoomDto,
    @CurrentAccount() account: Account,
  ) {
    return this.roomsService.createRoom(dto, account);
  }

  @Patch(':id')
  async updateRoom(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ skipMissingProperties: true, whitelist: true })) dto: UpdateRoomDto,
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
