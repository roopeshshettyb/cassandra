import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min, ValidateIf } from 'class-validator';
import { BookingStatus } from '../common/constants/constants.service';

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Structural shape for BookingsService.upsertByExternalId — implemented by
// integrations/dto's UpsertBookingDto, which does the actual runtime validation
// at the webhook controller boundary.
export interface BookingExternalUpsertPayload {
  externalId: string;
  startDate: string;
  endDate: string;
  roomNumber?: string;
  guestEmail: string;
  guestName?: string;
  guestPhone?: string;
}

export class CreateBookingDto {
  @IsString()
  @IsNotEmpty()
  @Matches(DATE_REGEX, { message: 'startDate must be YYYY-MM-DD' })
  @ApiProperty({ example: '2025-02-10' })
  readonly startDate: string;

  @IsString()
  @IsNotEmpty()
  @Matches(DATE_REGEX, { message: 'endDate must be YYYY-MM-DD' })
  @ApiProperty({ example: '2025-02-12' })
  readonly endDate: string;

  @IsEmail()
  @IsNotEmpty()
  @ApiProperty()
  readonly guestEmail: string;

  @IsInt()
  @IsNotEmpty()
  @ApiProperty()
  readonly hotelId: number;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly guestName?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly guestPhone?: string;

  @ValidateIf((dto) => !dto.roomTypeId)
  @IsString()
  @IsNotEmpty({ message: 'roomNumber is required when no roomTypeId is given' })
  @ApiProperty({ required: false, description: 'Required when roomTypeId is not given' })
  readonly roomNumber?: string;

  @IsOptional()
  @IsInt()
  @ApiProperty({ required: false, description: 'Reserve against dated inventory for this room type instead of a free-text room number' })
  readonly roomTypeId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @ApiProperty({ required: false, description: 'Rooms to reserve of roomTypeId' })
  readonly rooms?: number;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false })
  readonly sendInviteImmediately?: boolean;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ required: false, description: 'S3 key of uploaded reservation document (temp/) to attach to this booking' })
  readonly reservationDocumentKey?: string;
}

export class UpdateBookingDto {
  @IsOptional()
  @IsString()
  @Matches(DATE_REGEX, { message: 'startDate must be YYYY-MM-DD' })
  @ApiProperty({ required: false, example: '2025-02-10' })
  readonly startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_REGEX, { message: 'endDate must be YYYY-MM-DD' })
  @ApiProperty({ required: false, example: '2025-02-12' })
  readonly endDate?: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  readonly roomNumber: string;

  @IsOptional()
  @IsEnum(BookingStatus)
  @ApiProperty({ required: false, enum: BookingStatus })
  readonly status?: BookingStatus;
}

export class ReservationDocumentUploadUrlDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly contentType?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly filename?: string;
}

export class ReservationDocumentKeyDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  readonly key: string;
}
