import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsArray, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { RequestType, RequestUrgency, RequestStatus } from './requests.model';
import { ListQueryDto } from '../common/dto/list-query.dto';

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
  @ApiPropertyOptional({ type: [Object], default: [] })
  readonly userNotes?: any[];

  @IsOptional()
  @IsArray()
  @ApiPropertyOptional({ type: [Object], default: [] })
  readonly staffNotes?: any[];

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ description: 'Chat id when created via AI agent' })
  readonly chatId?: number;
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

// Structural shape for RequestsService.upsertByExternalId — implemented by
// integrations/dto's UpsertRequestDto, which does the actual runtime validation
// at the webhook controller boundary.
export interface RequestExternalUpsertPayload {
  externalId: string;
  bookingExternalId: string;
  requestType: RequestType;
  urgency: RequestUrgency;
  status?: RequestStatus;
  userNotes?: any[];
}

export class ListRequestsQueryDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(RequestStatus)
  @ApiPropertyOptional({ enum: RequestStatus })
  readonly status?: RequestStatus;

  @IsOptional()
  @IsEnum(RequestType)
  @ApiPropertyOptional({ enum: RequestType })
  readonly requestType?: RequestType;

  @IsOptional()
  @IsEnum(RequestUrgency)
  @ApiPropertyOptional({ enum: RequestUrgency })
  readonly urgency?: RequestUrgency;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ApiPropertyOptional()
  readonly hotelId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ApiPropertyOptional()
  readonly bookingId?: number;

  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'urgency'])
  @ApiPropertyOptional({ enum: ['createdAt', 'updatedAt', 'urgency'] })
  readonly sortBy?: 'createdAt' | 'updatedAt' | 'urgency';
}

export class AppendMessageDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  readonly message: string;
}
