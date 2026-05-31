import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, ValidationPipe, ParseIntPipe } from '@nestjs/common';
import { RestaurantService } from './restaurant.service';
import { CreateMenuItemDto, UpdateMenuItemDto, MenuOcrPresignedUrlDto, MenuOcrExtractDto, BulkCreateMenuItemsDto } from './restaurant.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentAccount } from '../auth/decorators/account.decorator';
import { Account } from '../accounts/accounts.model';

@Controller('restaurant')
@UseGuards(JwtAuthGuard)
export class RestaurantController {
  constructor(private readonly restaurantService: RestaurantService) {}

  @Get('menu-items')
  async findAll(
    @Query('hotelId', ParseIntPipe) hotelId: number,
    @CurrentAccount() account: Account,
  ) {
    return this.restaurantService.findAllForHotel(hotelId, account);
  }

  @Get('menu-items/:id')
  async findById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentAccount() account: Account,
  ) {
    return this.restaurantService.findById(id, account);
  }

  @Post('menu-items')
  async create(
    @Body(ValidationPipe) dto: CreateMenuItemDto,
    @CurrentAccount() account: Account,
  ) {
    return this.restaurantService.create(dto, account);
  }

  @Patch('menu-items/:id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ skipMissingProperties: true })) dto: UpdateMenuItemDto,
    @CurrentAccount() account: Account,
  ) {
    return this.restaurantService.update(id, dto, account);
  }

  @Delete('menu-items/:id')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentAccount() account: Account,
  ) {
    return this.restaurantService.delete(id, account);
  }

  @Post('menu-ocr/presigned-url')
  async getMenuOcrPresignedUrl(
    @Body(ValidationPipe) dto: MenuOcrPresignedUrlDto,
    @CurrentAccount() account: Account,
  ) {
    return this.restaurantService.getMenuOcrPresignedUrl(dto, account);
  }

  @Post('menu-ocr/extract')
  async extractMenuFromImages(
    @Body(ValidationPipe) dto: MenuOcrExtractDto,
    @CurrentAccount() account: Account,
  ) {
    return this.restaurantService.extractMenuFromImages(dto, account);
  }

  @Post('menu-items/bulk')
  async bulkCreate(
    @Body(ValidationPipe) dto: BulkCreateMenuItemsDto,
    @CurrentAccount() account: Account,
  ) {
    return this.restaurantService.bulkCreate(dto, account);
  }
}
