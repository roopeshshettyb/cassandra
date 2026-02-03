import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateHotelDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  readonly name: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  readonly address: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly checkInTime?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly checkOutTime?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly poolHours?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly gymHours?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly restaurantHours?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly wifiPassword?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly breakfastHours?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly lunchHours?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly dinnerHours?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly snacksHours?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly houseKeepingHours?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly roomServiceHours?: string;
}

export class UpdateHotelDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly name?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly address?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly checkInTime?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly checkOutTime?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly poolHours?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly gymHours?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly restaurantHours?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly wifiPassword?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly breakfastHours?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly lunchHours?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly dinnerHours?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly snacksHours?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly houseKeepingHours?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly roomServiceHours?: string;
}

export class GrantHotelAccessDto {
  @IsInt()
  @ApiProperty()
  readonly accountId: number;
}
