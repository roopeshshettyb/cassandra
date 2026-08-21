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

Only `name` and `description`, matching the `organisations` table this database
already had. Contact details and an active/disabled flag were here and came out
again: nothing asked for them, and each one needed an `ALTER` on a table the
application does not own — turning a one-statement deployment into a
four-statement one for no gain. They are cheap to add once ownership is sorted.

`sync()` creates the table complete where it is absent. Where it already exists,
the columns line up, so nothing needs altering.

One migration, in `database.providers.ts` with the others:

```sql
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS organisation_id
  INTEGER REFERENCES organisations(id);
```

**This one must actually succeed.** Once the model declares `organisationId`,
every account query selects it, so if the `ALTER` is skipped nobody can log in.
The runner logs and continues on failure by design, which makes a permission
error here quiet rather than loud — check the boot log for
`Migration skipped: ALTER TABLE accounts` before trusting a deploy.

On the shared database every table is owned by `postgres` while the application
connects as `flashpactone`, so it will be skipped there until someone with owner
rights runs it. That affects the pre-existing migrations for `hotels`, `bookings`
and `requests` too; the difference is that those are additive and this one is not.

The database also holds 13 rows left by that uncommitted work — one
`Park Hotel Company` and six `ctest_*` pairs from an API-test run. They are inert
and were left alone rather than deleted, since they are not ours to remove.
