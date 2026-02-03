import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';
import { RequestType, RequestUrgency, RequestStatus } from './requests.model';

/** room_service: data is array of items */
export interface RoomServiceDataItem {
  name: string;
  quantity?: number;
  notes?: string;
}

/** house_keeping: optional instructions */
export interface HouseKeepingData {
  instructions?: string;
}

/** laundry: optional items list */
export interface LaundryData {
  items?: string[];
}

/** airport_transfer: optional flight/pickup info */
export interface AirportTransferData {
  flightNumber?: string;
  pickupTime?: string;
  terminal?: string;
}

export type RequestDataByType = RoomServiceDataItem[] | HouseKeepingData | LaundryData | AirportTransferData;

export class CreateRequestDto {
  @IsInt()
  @IsNotEmpty()
  @ApiProperty()
  readonly hotelId: number;

  @IsInt()
  @IsNotEmpty()
  @ApiProperty()
  readonly guestId: number;

  @IsInt()
  @IsNotEmpty()
  @ApiProperty()
  readonly bookingId: number;

  @IsEnum(RequestType)
  @IsNotEmpty()
  @ApiProperty({ enum: RequestType })
  readonly requestType: RequestType;

  @IsEnum(RequestUrgency)
  @IsNotEmpty()
  @ApiProperty({ enum: RequestUrgency })
  readonly urgency: RequestUrgency;

  @IsOptional()
  @ApiPropertyOptional({ description: 'Structured data per requestType' })
  readonly data?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiPropertyOptional({ type: [String], default: [] })
  readonly userNotes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiPropertyOptional({ type: [String], default: [] })
  readonly staffNotes?: string[];
}

export class UpdateRequestDto {
  @IsOptional()
  @ApiPropertyOptional({ description: 'Structured data per requestType' })
  readonly data?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(RequestUrgency)
  @ApiPropertyOptional({ enum: RequestUrgency })
  readonly urgency?: RequestUrgency;

  @IsOptional()
  @IsEnum(RequestStatus)
  @ApiPropertyOptional({ enum: RequestStatus })
  readonly status?: RequestStatus;
}

export class AppendMessageDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  readonly message: string;
}
