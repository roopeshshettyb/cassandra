import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RoomStatus } from './rooms.model';
import { DATE_REGEX } from '../bookings/bookings.dto';

export class CreateRoomTypeDto {
  @IsInt()
  @ApiProperty()
  readonly hotelId: number;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  readonly name: string;

  @IsInt()
  @Min(1)
  @ApiProperty()
  readonly maxOccupancy: number;

  @IsInt()
  @Min(0)
  @ApiProperty({ description: 'Sellable rooms of this type. Opens as `total` on each night as it is first booked.' })
  readonly totalRooms: number;
}

export class UpdateRoomTypeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ required: false })
  readonly name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @ApiProperty({ required: false })
  readonly maxOccupancy?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiProperty({ required: false, description: 'Only changes nights that have not opened yet; use the inventory endpoint to restock open nights.' })
  readonly totalRooms?: number;
}

export class CreateRoomDto {
  @IsInt()
  @ApiProperty()
  readonly hotelId: number;

  @IsInt()
  @ApiProperty()
  readonly roomTypeId: number;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  readonly roomNumber: string;

  @IsOptional()
  @IsEnum(RoomStatus)
  @ApiProperty({ required: false, enum: RoomStatus })
  readonly status?: RoomStatus;
}

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ required: false })
  readonly roomNumber?: string;

  @IsOptional()
  @IsEnum(RoomStatus)
  @ApiProperty({ required: false, enum: RoomStatus })
  readonly status?: RoomStatus;
}

// Query strings arrive as text, so every numeric field here needs @Type to be a
// number by the time class-validator sees it.
export class InventoryQueryDto {
  @Type(() => Number)
  @IsInt()
  @ApiProperty()
  readonly roomTypeId: number;

  @Matches(DATE_REGEX)
  @ApiProperty({ description: 'First night, YYYY-MM-DD' })
  readonly startDate: string;

  @Matches(DATE_REGEX)
  @ApiProperty({ description: 'Checkout date, exclusive — the night before it is the last one returned' })
  readonly endDate: string;
}

export class UpdateInventoryDto {
  @IsInt()
  @ApiProperty()
  readonly roomTypeId: number;

  @Matches(DATE_REGEX)
  @ApiProperty()
  readonly startDate: string;

  @Matches(DATE_REGEX)
  @ApiProperty()
  readonly endDate: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiProperty({ required: false, description: 'Rooms held back from sale on every night in the range' })
  readonly blocked?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiProperty({ required: false, description: 'Sellable rooms on every night in the range' })
  readonly total?: number;
}

export class AvailabilityQueryDto {
  @Type(() => Number)
  @IsInt()
  @ApiProperty()
  readonly hotelId: number;

  @Matches(DATE_REGEX)
  @ApiProperty({ description: 'Check-in, YYYY-MM-DD' })
  readonly startDate: string;

  @Matches(DATE_REGEX)
  @ApiProperty({ description: 'Check-out, YYYY-MM-DD. The checkout night itself is not required.' })
  readonly endDate: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiProperty()
  readonly guests: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiProperty({ required: false })
  readonly rooms?: number;
}
