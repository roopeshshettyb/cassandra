import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly roomNumber?: string;

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

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly roomNumber?: string;
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
