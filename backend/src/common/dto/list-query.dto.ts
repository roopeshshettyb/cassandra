import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** Paging and ordering fields shared by the list endpoints. */
export class ListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ minimum: 1 })
  readonly page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ minimum: 1 })
  readonly pageSize?: number;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  readonly sortOrder?: 'asc' | 'desc';
}

/** Query params arrive as strings, so transform is required for @Type to apply. */
export const LIST_QUERY_PIPE_OPTIONS = { transform: true, whitelist: true, forbidNonWhitelisted: true };

type ListPagingLimits = { LIST_PAGE_DEFAULT: number; LIST_PAGE_SIZE_DEFAULT: number; LIST_PAGE_SIZE_MAX: number };

/** Null when neither page nor pageSize was asked for — the agent path, capped by its own AGENT_* limits. */
export function resolveListPaging(options: { page?: number; pageSize?: number } | undefined, limits: ListPagingLimits) {
  if (options?.page == null && options?.pageSize == null) return null;
  const pageSize = Math.min(options.pageSize ?? limits.LIST_PAGE_SIZE_DEFAULT, limits.LIST_PAGE_SIZE_MAX);
  const page = options.page ?? limits.LIST_PAGE_DEFAULT;
  return { limit: pageSize, offset: (page - 1) * pageSize, page };
}
