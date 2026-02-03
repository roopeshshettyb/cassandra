import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

const HH_MM_REGEX = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;

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
  @Matches(HH_MM_REGEX, { message: 'checkInTime must be HH:MM' })
  @ApiProperty({ required: false })
  readonly checkInTime?: string;

  @IsOptional()
  @IsString()
  @Matches(HH_MM_REGEX, { message: 'checkOutTime must be HH:MM' })
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

export class AddHotelStaffDto {
  @IsEmail()
  @IsNotEmpty()
  @ApiProperty()
  readonly email: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly name?: string;
}
