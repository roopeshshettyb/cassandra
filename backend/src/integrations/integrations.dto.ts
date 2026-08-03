import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { DATE_REGEX, BookingExternalUpsertPayload } from '../bookings/bookings.dto';
import { RequestExternalUpsertPayload } from '../requests/requests.dto';
import { RequestType, RequestUrgency, RequestStatus } from '../requests/requests.model';

// MaxLength(255) mirrors the VARCHAR(255) columns these fields are written into
// (bookings.external_id, accounts.phone, etc.) — without it, an oversized value
// passes DTO validation and 500s on the raw Postgres "value too long" error instead
// of a clean 400.
export class UpsertBookingDto implements BookingExternalUpsertPayload {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @ApiProperty({ example: 'pms-res-123' })
  readonly externalId: string;

  @IsString()
  @IsNotEmpty()
  @Matches(DATE_REGEX, { message: 'startDate must be YYYY-MM-DD' })
  @ApiProperty({ example: '2026-07-20' })
  readonly startDate: string;

  @IsString()
  @IsNotEmpty()
  @Matches(DATE_REGEX, { message: 'endDate must be YYYY-MM-DD' })
  @ApiProperty({ example: '2026-07-22' })
  readonly endDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @ApiPropertyOptional()
  readonly roomNumber?: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  @ApiProperty()
  readonly guestEmail: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @ApiPropertyOptional()
  readonly guestName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @ApiPropertyOptional()
  readonly guestPhone?: string;
}

export class UpsertRequestDto implements RequestExternalUpsertPayload {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @ApiProperty({ example: 'pms-req-9' })
  readonly externalId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @ApiProperty({ example: 'pms-res-123' })
  readonly bookingExternalId: string;

  @IsEnum(RequestType)
  @IsNotEmpty()
  @ApiProperty({ enum: RequestType })
  readonly requestType: RequestType;

  @IsEnum(RequestUrgency)
  @IsNotEmpty()
  @ApiProperty({ enum: RequestUrgency })
  readonly urgency: RequestUrgency;

  @IsOptional()
  @IsEnum(RequestStatus)
  @ApiPropertyOptional({ enum: RequestStatus })
  readonly status?: RequestStatus;

  @IsOptional()
  @IsArray()
  @ApiPropertyOptional({ type: [Object] })
  readonly userNotes?: any[];
}
