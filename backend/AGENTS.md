# Backend rules

## Constants

- Enums, statuses, labels, limits, `PERMISSIONS` and all strings live in `ConstantsService` (`src/common/constants/constants.service.ts`). Import them; never redefine them.
- Env values go in `private`. Values the frontend needs go in `public`; after changing them, run `npm run fetch-constants` in `frontend/`.

## Module layout

- One folder per feature in `src/<feature>/`: `.module`, `.controller`, `.service`, `.repository`, `.dto` and `.model` files. `src/rooms/` is the reference.
- **Repository**: a token plus `{ provide: X_REPOSITORY, useValue: Model }`, injected as `@Inject(X_REPOSITORY) private readonly xRepository: typeof Model`.
- **Controller**: thin. It parses the request and calls the service.
- **Service**: holds all logic and returns the response.

## Requests and responses

- Validate input with DTO classes (`class-validator` plus `@ApiProperty`, `readonly` fields) through `ValidationPipe`, preferably `{ whitelist: true }`. Parse ids with `ParseIntPipe`.
- Throw Nest exceptions (`NotFoundException`, `BadRequestException`, ...). Their message is shown to the user.
- Every API returns `{ success, message, data }`. `message` is shown to the user; use `null` to show nothing.
- Lists that search or filter use `src/common/filters/list-filters.ts`: mark columns `filterable` or `searchable` and expose `GET <endpoint>/filters`, as `hotels`, `bookings` and `requests` do.

## Security: every API is secure

- Put `@UseGuards(JwtAuthGuard)` on the controller, and read the caller with `@CurrentAccount() account: Account`. Admin-only routes use `@AdminOnly()`. Role-based actions use `PERMISSIONS`.
- **Always verify ownership** in the service before reading or changing a record, as `findRoomForAccount` in `src/rooms/rooms.service.ts` does.

## Database

- Models: camelCase properties, with `field: 'snake_case'` for multi-word columns. Register each new model in `models` in `src/database/database.providers.ts`.
- For each new column on an existing table, add an `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` to `migrations` in `database.providers.ts`; `sync()` won't add it.
- For status values, use string columns, not new Postgres `ENUM`s: the managed DB role can't `ALTER TYPE`.
- Wrap multi-step writes in `this.sequelize.transaction(...)`.
- Update `src/seed.ts` for every new or changed model, with ample data. Keep it idempotent: the e2e suite relies on it.
- Log with `LoggerService`, not `console.log`.

## Tests (see `test/README.md`)

- `test/api/` (`npm run test:api`): HTTP and socket tests against a local database. For every route, cover the happy path, known errors and ownership (outsider, wrong role, guest). Tag what you create and delete it afterwards.
- `test/unit/` (`npm run test:unit`): mocked, for what API tests can't show (transactions, retries, date and price maths, outside services). Don't repeat a case an API test already proves.
- Add every new route to `test/unit/routes.spec.ts` with its access rule.
- Known problems are written as `test.failing` and listed in `test/README.md`. When you fix one, drop `.failing` and remove its row.
