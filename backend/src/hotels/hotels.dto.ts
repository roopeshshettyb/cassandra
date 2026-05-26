import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Matches, ValidateIf, IsEnum, IsIn } from 'class-validator';
// IsBoolean used by UpdateBrandDto
import { HotelMemberStatus, NotificationTone } from '../common/constants/constants.service';
import { AccountRole } from '../accounts/accounts.model';

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
  readonly website?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly phoneNumber?: string;

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

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly llmInstructions?: string;

  @IsOptional()
  @ValidateIf((o) => o.themeConfig != null)
  @IsObject()
  @ApiProperty({ required: false })
  readonly themeConfig?: Record<string, unknown>;
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
  readonly website?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly phoneNumber?: string;

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

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly llmInstructions?: string;

  @IsOptional()
  @ValidateIf((o) => o.themeConfig != null)
  @IsObject()
  @ApiProperty({ required: false })
  readonly themeConfig?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(NotificationTone)
  @ApiProperty({ required: false, enum: NotificationTone })
  readonly notificationTone?: NotificationTone;
}

export class UpdateBrandDto {
  @IsOptional()
  @IsString()
  readonly checkInTime?: string;

  @IsOptional()
  @IsString()
  readonly checkOutTime?: string;

  @IsOptional()
  @IsString()
  readonly poolHours?: string;

  @IsOptional()
  @IsString()
  readonly gymHours?: string;

  @IsOptional()
  @IsString()
  readonly restaurantHours?: string;

  @IsOptional()
  @IsString()
  readonly wifiPassword?: string;

  @IsOptional()
  @IsString()
  readonly breakfastHours?: string;

  @IsOptional()
  @IsString()
  readonly lunchHours?: string;

  @IsOptional()
  @IsString()
  readonly dinnerHours?: string;

  @IsOptional()
  @IsString()
  readonly snacksHours?: string;

  @IsOptional()
  @IsString()
  readonly houseKeepingHours?: string;

  @IsOptional()
  @IsString()
  readonly roomServiceHours?: string;

  @IsOptional()
  @IsString()
  readonly llmInstructions?: string;

  @IsOptional()
  @ValidateIf((o) => o.themeConfig != null)
  @IsObject()
  readonly themeConfig?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  readonly propagate?: boolean;
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

  @IsIn([AccountRole.HOTEL_STAFF, AccountRole.HOTEL_OWNER])
  @ApiProperty({ enum: [AccountRole.HOTEL_STAFF, AccountRole.HOTEL_OWNER] })
  readonly role: AccountRole;
}

export class UpdateHotelStaffStatusDto {
  @IsEnum(HotelMemberStatus)
  @ApiProperty({ enum: HotelMemberStatus })
  readonly status: HotelMemberStatus;
}

export class ImportHotelMembersCsvDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  readonly csvContent: string;
}
