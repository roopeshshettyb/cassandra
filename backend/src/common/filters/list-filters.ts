import { BadRequestException } from '@nestjs/common';
import { Model, Op } from 'sequelize';

/**
 * Lets a column declare how it takes part in list filtering right where it is defined:
 *
 *   `@Column({ type: DataType.ENUM(...), filterable: true })`
 *   `@Column({ type: DataType.STRING, searchable: true })`
 *
 * Sequelize keeps unknown keys on `rawAttributes`, so the flags survive to runtime and
 * `getListFilters` can build the whole filter contract from the model alone. Showing a filter for a
 * new column is that one flag — no DTO field, no service branch, no frontend config.
 */
declare module 'sequelize' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ModelAttributeColumnOptions<M extends Model = Model> {
    /** Offer this column as a filter. An enum becomes a multi-select, anything else a single input. */
    filterable?: boolean;
    /** Include this column in the list's search box (case-insensitive contains). */
    searchable?: boolean;
    /**
     * The choices for a filter whose values are not the column's own — needed on a VIRTUAL column,
     * which has nothing stored to derive them from. Comes with `filterWhere`.
     */
    filterOptions?: { value: string; label: string }[];
    /**
     * Turns a chosen value into a where fragment, for a filter that no single column can express —
     * a stay being current, say, which compares two columns against now. The fragment is ANDed onto
     * the query like any other condition, so it can touch any column of the model.
     */
    filterWhere?: (value: string) => Record<string, any>;
  }
}

export type FilterType = 'enum' | 'boolean' | 'number' | 'text' | 'date';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  type: FilterType;
  /** True for enums: the UI shows checkboxes and the value travels as a comma-separated list. */
  multiple: boolean;
  options?: FilterOption[];
}

/** What the frontend needs to build the controls for one list. */
export interface ListFilterMeta {
  filters: FilterConfig[];
  /** Null when no column is searchable, which hides the search box. */
  searchLabel: string | null;
}

/**
 * What a list endpoint accepts: the search box, plus one key per filterable column. The columns are
 * not spelled out — that is the point — so the query is typed loosely and checked at runtime by
 * `validateListQuery` against the model.
 */
export interface ListQuery {
  search?: string;
  [filterKey: string]: any;
}

const SEARCH_KEY = 'search';

const NUMERIC_TYPES = ['INTEGER', 'BIGINT', 'FLOAT', 'DOUBLE PRECISION', 'DECIMAL', 'REAL'];
// Only these compare with iLike. A JSONB column would need a key path rather than a match against
// the whole document, so it is refused by name rather than silently treated as text.
const TEXT_TYPES = ['STRING', 'TEXT', 'CHAR', 'CITEXT', 'UUID'];
const DATE_TYPES = ['DATE', 'DATEONLY'];

/** A date is a range, so it owns two query keys — startTimeFrom and startTimeTo — rather than one. */
const DATE_FROM = 'From';
const DATE_TO = 'To';

/** `request_type` and `requestType` both read as "Request Type". */
function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function attributesOf(model: any): Record<string, any> {
  return model.rawAttributes ?? model.getAttributes();
}

/** Null for a column type this cannot build a control for — see `typeOf` for what happens then. */
function attributeType(attribute: any): FilterType | null {
  const key = attribute?.type?.key;
  if (key === 'ENUM') return 'enum';
  if (key === 'BOOLEAN') return 'boolean';
  if (NUMERIC_TYPES.indexOf(key) !== -1) return 'number';
  if (TEXT_TYPES.indexOf(key) !== -1) return 'text';
  if (DATE_TYPES.indexOf(key) !== -1) return 'date';
  return null;
}

/**
 * The flag is meant to be a one-line toggle, so an unsupported column type has to say so plainly.
 * Falling back to a text match would send `iLike` at a timestamp or a JSONB column and fail in the
 * database, a long way from the line that caused it.
 */
function typeOf(model: any, key: string, attribute: any, flag: 'filterable' | 'searchable'): FilterType {
  const type = attributeType(attribute);
  // Searching is one iLike across several columns, so it takes text and nothing else — a date or a
  // number would reach the database as a pattern match against the wrong type.
  const supported: FilterType[] = flag === 'searchable' ? ['text'] : ['enum', 'boolean', 'number', 'text', 'date'];
  if (type === null || supported.indexOf(type) === -1) {
    throw new Error(
      `${model.name}.${key} is ${attribute?.type?.key}: \`${flag}\` supports ${supported.join(', ')} columns only`,
    );
  }
  return type;
}

function pickAttributes(model: any, flag: 'filterable' | 'searchable'): [string, any][] {
  const attributes = attributesOf(model);
  return Object.keys(attributes)
    .filter((key) => attributes[key][flag] === true)
    .map((key): [string, any] => [key, attributes[key]]);
}

/** "name or address" — reads as a sentence in the search box label. */
function joinWithOr(parts: string[]): string {
  if (parts.length < 2) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} or ${parts[parts.length - 1]}`;
}

/** The filter contract for one model: what the UI should render and what the endpoint will accept. */
export function getListFilters(model: any): ListFilterMeta {
  const filters = pickAttributes(model, 'filterable').map(([key, attribute]) => {
    // A column that declares its own choices needs nothing from its type — it may not even be
    // stored. `filterWhere` turns the chosen value into the query.
    if (attribute.filterOptions) {
      return { key, label: humanize(key), type: 'enum' as FilterType, multiple: false, options: attribute.filterOptions };
    }

    const type = typeOf(model, key, attribute, 'filterable');
    const config: FilterConfig = { key, label: humanize(key), type, multiple: type === 'enum' };
    if (type === 'enum') {
      config.options = attribute.values.map((value: string) => ({ value, label: humanize(value) }));
    } else if (type === 'boolean') {
      config.options = [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }];
    }
    return config;
  });

  // Searching is an iLike, so the same column types apply.
  const searchable = pickAttributes(model, 'searchable').map(([key, attribute]) => {
    typeOf(model, key, attribute, 'searchable');
    return humanize(key).toLowerCase();
  });

  return {
    filters,
    searchLabel: searchable.length > 0 ? `Search by ${joinWithOr(searchable)}` : null,
  };
}

/** Multi-select values arrive as `?status=pending,completed` or as a repeated param. */
function toList(value: any): string[] {
  const list = Array.isArray(value) ? value : String(value).split(',');
  return list.map((entry) => String(entry).trim()).filter(Boolean);
}

function reject(key: string, value: unknown): never {
  throw new BadRequestException(`Invalid value for ${key}: ${String(value)}`);
}

/** One value or an IN list — never an empty IN, which matches nothing instead of everything. */
function equalsAny(values: any[]): any {
  return values.length === 1 ? values[0] : { [Op.in]: values };
}

/** ANDs a condition onto a key the caller's scope may already constrain, so nothing is dropped. */
function andWhere(where: any, key: string | symbol, condition: any): void {
  if (where[key] === undefined) {
    where[key] = condition;
    return;
  }
  where[key] = { [Op.and]: [where[key], condition] };
}

/** `>= from` and `<= to`, either bound optional. Undefined when neither was given. */
function dateRange(key: string, query: any): any {
  const bounds: [string, symbol][] = [[key + DATE_FROM, Op.gte], [key + DATE_TO, Op.lte]];
  const range: any = {};

  bounds.forEach(([queryKey, operator]) => {
    const given = query[queryKey];
    if (given == null || given === '') return;
    const parsed = new Date(String(given));
    if (isNaN(parsed.getTime())) reject(queryKey, given);
    range[operator] = parsed;
  });

  return Object.getOwnPropertySymbols(range).length > 0 ? range : undefined;
}

function whereForAttribute(model: any, key: string, attribute: any, query: any): any {
  // Checked here too: the list endpoint can be called without anyone reading /filters first.
  const type = typeOf(model, key, attribute, 'filterable');
  if (type === 'date') return dateRange(key, query);

  const raw = query[key];
  if (raw == null || raw === '') return undefined;

  // Free text is taken whole: a comma is a character someone typed, not a separator.
  if (type === 'text') {
    const text = String(raw).trim();
    return text ? { [Op.iLike]: `%${text}%` } : undefined;
  }

  const values = toList(raw);
  if (values.length === 0) return undefined;

  if (type === 'enum') {
    values.forEach((value) => {
      if (attribute.values.indexOf(value) === -1) reject(key, value);
    });
    return equalsAny(values);
  }
  if (type === 'boolean') {
    if (values.length > 1 || ['true', 'false'].indexOf(values[0]) === -1) reject(key, raw);
    return values[0] === 'true';
  }
  return equalsAny(values.map((value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) reject(key, value);
    return parsed;
  }));
}

/**
 * Turns the querystring into Sequelize conditions using only what the model declares, and merges
 * them into `where` — which already holds the caller's ownership scope, so conditions are ANDed on
 * and a filter can never widen what the caller is allowed to see.
 */
export function buildListWhere(model: any, rawQuery: any, where: any = {}): any {
  const query = rawQuery ?? {};

  pickAttributes(model, 'filterable').forEach(([key, attribute]) => {
    // A self-describing filter builds its own fragment, which can constrain any column, so each
    // part of it is ANDed on separately rather than filed under this key.
    if (attribute.filterOptions) {
      const chosen = query[key];
      if (chosen == null || chosen === '') return;
      if (!attribute.filterOptions.some((option: FilterOption) => option.value === chosen)) reject(key, chosen);
      // The two go together: options say what may be chosen, filterWhere says what that means.
      if (typeof attribute.filterWhere !== 'function') {
        throw new Error(`${model.name}.${key} declares \`filterOptions\` but no \`filterWhere\` to apply them`);
      }
      const fragment = attribute.filterWhere(String(chosen));
      Object.keys(fragment).forEach((column) => andWhere(where, column, fragment[column]));
      return;
    }

    const condition = whereForAttribute(model, key, attribute, query);
    if (condition !== undefined) andWhere(where, key, condition);
  });

  const search = query[SEARCH_KEY] == null ? '' : String(query[SEARCH_KEY]).trim();
  const searchable = pickAttributes(model, 'searchable');
  searchable.forEach(([key, attribute]) => typeOf(model, key, attribute, 'searchable'));
  if (search && searchable.length > 0) {
    const pattern = `%${search}%`;
    // Op.and, not Op.or: a bare Op.or would replace one the scope already set.
    andWhere(where, Op.and, {
      [Op.or]: searchable.map(([key]) => ({ [key]: { [Op.iLike]: pattern } })),
    });
  }

  return where;
}

/**
 * Rejects query keys the endpoint does not serve. List endpoints take a raw query object rather
 * than a DTO — the point is that no DTO lists the filters — so this is the whitelist.
 * `allowedKeys` covers params a service consumes itself, such as a path-level id.
 */
export function validateListQuery(model: any, query: any, allowedKeys: string[] = []): void {
  if (!query) return;

  const allowed = new Set([SEARCH_KEY, ...allowedKeys]);
  pickAttributes(model, 'filterable').forEach(([key, attribute]) => {
    if (attribute.filterOptions) {
      allowed.add(key);
      return;
    }
    if (attributeType(attribute) === 'date') {
      allowed.add(key + DATE_FROM);
      allowed.add(key + DATE_TO);
      return;
    }
    allowed.add(key);
  });

  Object.keys(query).forEach((key) => {
    // Internal callers build one options object and leave the keys they do not use undefined.
    if (query[key] === undefined) return;
    if (!allowed.has(key)) throw new BadRequestException(`Unknown query parameter: ${key}`);
  });
}
