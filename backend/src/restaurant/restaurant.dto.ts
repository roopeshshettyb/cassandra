import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEnum, IsArray, IsBoolean, IsInt, Matches, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { MenuItemCategory } from './restaurant.model';

const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

export class CreateMenuItemDto {
  @IsInt()
  @ApiProperty()
  readonly hotelId: number;

  @IsString()
  @ApiProperty()
  readonly name: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ required: false })
  readonly description?: string;

  @IsNumber()
  @ApiProperty()
  readonly price: number;

  @IsEnum(MenuItemCategory)
  @ApiProperty({ enum: MenuItemCategory })
  readonly category: MenuItemCategory;

  @IsString()
  @IsOptional()
  @Matches(TIME_REGEX, { message: 'availableStartTime must be HH:mm format' })
  @ApiProperty({ required: false, example: '07:00' })
  readonly availableStartTime?: string;

  @IsString()
  @IsOptional()
  @Matches(TIME_REGEX, { message: 'availableEndTime must be HH:mm format' })
  @ApiProperty({ required: false, example: '22:00' })
  readonly availableEndTime?: string;

  @IsBoolean()
  @IsOptional()
  @ApiProperty({ required: false, default: true })
  readonly isAvailable?: boolean;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @ApiProperty({ required: false, type: [String], example: ['vegetarian', 'vegan'] })
  readonly dietaryTags?: string[];

  @IsString()
  @IsOptional()
  @ApiProperty({ required: false })
  readonly imageUrl?: string;

  @IsInt()
  @IsOptional()
  @ApiProperty({ required: false, default: 0 })
  readonly sortOrder?: number;
}

export class MenuOcrPresignedUrlDto {
  @IsInt()
  @ApiProperty()
  readonly hotelId: number;

  @IsString()
  @ApiProperty()
  readonly fileName: string;

  @IsNumber()
  @ApiProperty()
  readonly fileSize: number;

  @IsString()
  @ApiProperty()
  readonly contentType: string;
}

export class MenuOcrExtractDto {
  @IsInt()
  @ApiProperty()
  readonly hotelId: number;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ApiProperty({ type: [String] })
  readonly imageUrls: string[];
}

export class BulkCreateMenuItemsDto {
  @IsInt()
  @ApiProperty()
  readonly hotelId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMenuItemDto)
  @ArrayMinSize(1)
  @ApiProperty({ type: [CreateMenuItemDto] })
  readonly items: CreateMenuItemDto[];
}

export class UpdateMenuItemDto {
  @IsString()
  @IsOptional()
  @ApiProperty({ required: false })
  readonly name?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ required: false })
  readonly description?: string;

  @IsNumber()
  @IsOptional()
  @ApiProperty({ required: false })
  readonly price?: number;

  @IsEnum(MenuItemCategory)
  @IsOptional()
  @ApiProperty({ required: false, enum: MenuItemCategory })
  readonly category?: MenuItemCategory;

  @IsString()
  @IsOptional()
  @Matches(TIME_REGEX, { message: 'availableStartTime must be HH:mm format' })
  @ApiProperty({ required: false, example: '07:00' })
  readonly availableStartTime?: string;

  @IsString()
  @IsOptional()
  @Matches(TIME_REGEX, { message: 'availableEndTime must be HH:mm format' })
  @ApiProperty({ required: false, example: '22:00' })
  readonly availableEndTime?: string;

  @IsBoolean()
  @IsOptional()
  @ApiProperty({ required: false })
  readonly isAvailable?: boolean;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @ApiProperty({ required: false, type: [String] })
  readonly dietaryTags?: string[];

  @IsString()
  @IsOptional()
  @ApiProperty({ required: false })
  readonly imageUrl?: string;

  @IsInt()
  @IsOptional()
  @ApiProperty({ required: false })
  readonly sortOrder?: number;
}
