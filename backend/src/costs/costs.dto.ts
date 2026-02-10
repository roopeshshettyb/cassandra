import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsNumberString, IsOptional, IsString } from 'class-validator';
import { CostType } from './costs.model';

export class CostDto {
  @IsInt()
  @ApiProperty()
  readonly id: number;

  @IsEnum(CostType)
  @ApiProperty({ enum: CostType })
  readonly type: CostType;

  @IsNumberString()
  @ApiProperty({ description: 'Exact cost amount in major currency units, as a decimal string' })
  readonly amount: string;

  @IsString()
  @ApiProperty({ example: 'usd' })
  readonly currency: string;

  @IsOptional()
  @ApiPropertyOptional({ type: Object })
  readonly meta?: Record<string, unknown> | null;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional()
  readonly bookingId?: number | null;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional()
  readonly hotelId?: number | null;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional()
  readonly accountId?: number | null;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional()
  readonly chatId?: number | null;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional()
  readonly messageId?: number | null;
}

export class CreateCostDto {
  @IsEnum(CostType)
  @IsNotEmpty()
  @ApiProperty({ enum: CostType })
  readonly type: CostType;

  @IsNumberString()
  @IsNotEmpty()
  @ApiProperty({ description: 'Exact cost amount in major currency units, as a decimal string' })
  readonly amount: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'usd' })
  readonly currency: string;

  @IsOptional()
  @ApiPropertyOptional({ type: Object })
  readonly meta?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional()
  readonly bookingId?: number;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional()
  readonly hotelId?: number;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional()
  readonly accountId?: number;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional()
  readonly chatId?: number;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional()
  readonly messageId?: number;
}

