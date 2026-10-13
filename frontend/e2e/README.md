# UI tests (Playwright)

Everything for the UI tests lives in this folder. They drive the real frontend in Chromium against
the real backend and a seeded local Postgres.

```
npm run test:e2e                        # every spec
npx playwright test -c e2e hotels       # one spec
npx playwright show-report e2e/playwright-report
```

## What a run does

1. Seeds the database (`npm run seed` in `backend/`), builds the backend and starts it on port 7677.
2. Fetches the frontend constants from it, builds the frontend into `e2e/build` and serves it on
   port 7679. Dev servers on 7676 and 7678 are left alone. Like `npm start`, the fetch rewrites
   `src/constants.json`, here with the test backend's values: discard that change after a local run.
3. `auth.setup.js` signs the seeded admin, owner, staff and guest in through the email-code flow
   and saves each session in `.auth/`. A spec runs as a role with `as('<role>')`.

## Setup (once)

A run seeds and changes data, so it refuses to start unless the database is on localhost.

1. Create an empty local Postgres database, e.g. `cassandra_test`. The backend creates the tables.
2. Point `backend/test.env` (git-ignored, wins over `dev.env`) at it:
   ```
   PORT=7677
   DB_HOST=localhost
   DB_PORT=5433
   DB_USERNAME=postgres
   DB_PASSWORD=...
   DB_NAME=cassandra_test
   DB_SSL=false
   ```
3. `npx playwright install chromium`

CI (`.github/workflows/frontend-tests.yml`) sets the same values in the environment.

## Layout

| Path | What |
|---|---|
| `playwright.config.js` | The sign-in setup, the two servers, output folders |
| `auth.setup.js` | Signs each seeded role in once |
| `*.spec.js` | One per page or flow |
| `support/env.js` | Settings, ports, the local-database guard, paid services switched off |
| `support/session.js` | Seeded accounts and hotel, the email-code sign-in, saved tokens, invite tokens |
| `support/ui.js` | `as(role)`, `navigate`, `back`, `openHotel`, `tab`, `save`, `toast`, `errorToast`, `successToast`, `fakeApi`, `failApi`, `fakeS3`, `PNG` |
| `support/api.js` | `apiAs(role)` to set up data through the backend, `uniqueName`, `uniqueRoom`, `uniqueEmail`, `day` |
| `support/serve.js` | Serves `build/` as a single-page app |

`.auth/`, `build/`, `test-results/` and `playwright-report/` are generated and git-ignored.

## How the specs are written

- Happy paths go through the UI against real data. A test makes what it changes (a hotel, a brand,
  a booking, a request) through `apiAs`, with a unique name, so seeded data stays as seeded.
- Errors the backend really gives (refused, not found, another organisation's data) are real.
- Errors that are hard to cause (a server fault) use `failApi`; the test checks the toast.
- Each role sees only the pages and buttons `PERMISSIONS` in `constants.json` allow.
- Outside services never run. The servers get no model, maps or search keys and placeholder AWS
  keys (`support/env.js`). Where a screen depends on one, `fakeApi` answers that backend call
  (hotel search and reading, reservation and menu reading, the Google callback) and `fakeS3`
  accepts the browser's upload; everything else in the flow is real.

## Known problems

Each is written as the intended behaviour with `test.fail()`: it passes while the problem is open
and fails once it is fixed, which is the cue to remove `test.fail()`.

| Problem | Test |
|---|---|
| A dashboard that fails to load blanks the whole app: `Dashboard.js` passes no `defaultData`, so `api.js` sets it to `[]` and reading `stats` throws. | `dashboard.spec.js` |
| A notification preference that fails to save is not reported, and the switch stays flipped. | `notifications.spec.js` |
| An active integration token shows a blank status: `constants.json` has no `INTEGRATIONS.STATUS_ACTIVE_LABEL`. | `hotel-details.spec.js` |
| A hotel without check-in and check-out times cannot be saved: the page sends them as `''`, which the backend refuses ("must be HH:MM"). | `hotel-details.spec.js` |

Intermittent, so not a test (one that fails at random would block PRs at random): after signing in
from the landing page, the `/` route's redirect to `/dashboard` races with the page sign-in sends
the user to (their stay, or Manage Hotels), and sometimes wins. Likewise a hotel's page
(`HotelDetails.js`) loads the hotel again once the signed-in role is known (its `useEffect` depends
on `canManageStaff`), wiping any edit typed before then; the specs wait for the page to settle first.

Needs a live outside service, so not driven: a concierge reply (only its failure is checked), voice
recording, and the Google sign-in popup itself (the return from it is).
