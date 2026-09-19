import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { Type, TransformFnParams } from 'class-transformer';

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

/**
 * Multi-select filters arrive as `?status=pending,completed` (or as a repeated param, which
 * Express already hands over as an array). Always produces an array so the services have one
 * shape to branch on; undefined when nothing was selected, so @IsOptional still short-circuits.
 */
export const toFilterList = ({ value }: TransformFnParams): string[] | undefined => {
  if (value == null || value === '') return undefined;
  const list = Array.isArray(value) ? value : String(value).split(',');
  const cleaned = list.map((entry) => String(entry).trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : undefined;
};

/** Query params arrive as strings, so transform is required for @Type to apply. */
export const LIST_QUERY_PIPE_OPTIONS = { transform: true, whitelist: true, forbidNonWhitelisted: true };

const FIRST_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

/** Null when neither page nor pageSize was asked for — the unpaged path, which returns every matching row. */
export function resolveListPaging(options: { page?: number; pageSize?: number } | undefined) {
  if (options?.page == null && options?.pageSize == null) return null;
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const page = options.page ?? FIRST_PAGE;
  return { limit: pageSize, offset: (page - 1) * pageSize, page };
}
