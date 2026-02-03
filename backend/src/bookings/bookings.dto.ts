import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

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
}
