import { IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsArray, IsNumber, IsBoolean, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgentJobAction } from './agent-jobs.model';

export class EnqueueAgentJobDto {
  @IsEnum(AgentJobAction)
  @IsNotEmpty()
  @ApiProperty({ enum: AgentJobAction })
  readonly action: AgentJobAction;

  @IsOptional()
  @IsObject()
  @ApiPropertyOptional({ type: Object })
  readonly params?: Record<string, unknown>;
}

// Posted by the Python browser worker when a job finishes. `verified` must only be
// true when the worker re-read the record through a second navigation and the value
// matched — the browser agent's own "task completed" signal is not sufficient.
export class CompleteAgentJobDto {
  @IsBoolean()
  @ApiProperty({ example: true })
  readonly success: boolean;

  @IsOptional()
  @IsObject()
  @ApiPropertyOptional({ type: Object })
  readonly result?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  readonly error?: string;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ example: true })
  readonly verified?: boolean;

  @IsOptional()
  @IsArray()
  @ApiPropertyOptional({ type: [String] })
  readonly screenshotKeys?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiPropertyOptional({ example: 18400 })
  readonly durationMs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiPropertyOptional({ example: 0.0077 })
  readonly costUsd?: number;
}
