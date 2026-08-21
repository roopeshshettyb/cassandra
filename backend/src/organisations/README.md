# Organisations

A customer company: the hotel group an owner and their staff belong to.

The scoping rule the whole module turns on:

| role | `organisationId` | sees |
| --- | --- | --- |
| `admin` | always `null` | every organisation, every staff-side user |
| `hotel_owner` | required | their own organisation, and only its users |
| `hotel_staff` | required | nothing here — no management screens |
| `guest` | always `null` | nothing; guests belong to a hotel via their booking |

`null` is meaningful rather than missing. An admin is platform staff who sits
outside every organisation, so `null` means "unscoped, sees all" — never
"orphaned". That is why `resolveOrganisationForRole` refuses to give an admin an
organisation and refuses to create an owner or staff member without one.

Only an admin may mint another admin. Without that rule an owner could promote
themselves to admin and step straight out of the scope that contains them, which
would make every other check here decorative.

## Routes

| route | who |
| --- | --- |
| `GET /organisations` | admin (all) · owner (their own — the users screen needs the name to label rows) |
| `GET /organisations/:id` | admin · owner, own only |
| `POST/PATCH/DELETE /organisations` | admin only (`@AdminOnly`) |
| `GET /organisation-users` | admin (all) · owner (own organisation) |
| `POST/PATCH /organisation-users` | admin · owner, narrowed in the service |

Kept apart from `/accounts`, which is self-service (`me`, `count`). These routes
administer *other* people, and are guarded in the service rather than by
`@AdminOnly`, because owners are allowed in — just narrowed.

A delete is refused while the organisation still has members. Cascading would
leave those accounts with a dangling `organisationId`, which reads as *unscoped*
— a quiet privilege change instead of a loud error.

## Schema

The column migrations live in `src/database/database.providers.ts` alongside the
existing ones, so they run on boot and are idempotent:

```sql
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(255);
-- enum_organisations_status created if absent
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS status ... DEFAULT 'active';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id);
```

`sync()` creates `organisations` complete where it does not exist. This database
already had one (`id`, `name`, `description`) from work that never reached this
repo, and `sync()` never alters an existing table — hence the explicit columns.

**The `accounts` migration must succeed before this ships.** Every account query
selects `organisation_id` once the model declares it, so if the `ALTER` is skipped
nobody can log in. The runner deliberately logs and continues on failure, which
means a permission error here is quiet rather than loud — check the boot log for
`Migration skipped: ALTER TABLE accounts` before trusting a deploy.

On the shared dev database every table is owned by `postgres` while the app
connects as `flashpactone`, so *all* of these are skipped, along with the
pre-existing ones for `hotels`, `bookings` and `requests`. That is an environment
problem rather than a code one, but it does mean the module cannot be exercised
there until someone with owner rights runs them.

The dev database also holds 13 rows left by that uncommitted work — one
`Park Hotel Company` and six `ctest_*` pairs from an API-test run. They are inert
and were left alone rather than deleted, since they are not ours to remove.
