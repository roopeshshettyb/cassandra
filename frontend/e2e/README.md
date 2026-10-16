# UI tests (Playwright)

Every UI interaction, happy path and known errors, driven in a real browser against a seeded backend.
They run on every PR into `main` and `stage` (`.github/workflows/frontend-tests.yml`).

## Run locally

1. A local Postgres, and `backend/test.env` pointing at it (the same file the API tests use):

   ```
   DB_HOST=localhost
   DB_PORT=5433
   DB_USERNAME=postgres
   DB_PASSWORD=...
   ```

   The run creates its own `cassandra_e2e` database there, drops it on the next run, and never touches another host.

2. From `frontend/`, once: `npx playwright install chromium firefox webkit msedge` (Edge installs the real browser; on
   macOS and Linux that can ask for your password, and if Edge is already installed it is used as is)
3. `npm run test:e2e` runs every browser: Chromium (Chrome), Firefox, WebKit (Safari's engine) and Edge, plus the phone-sized
   specs in Chromium. Pick some with `--project`, e.g. `npm run test:e2e -- --project=webkit`.

Playwright builds and starts the backend (port 7679, `NODE_ENV=automation_test`: no emails, no S3, placeholder AI keys), seeds it,
builds the frontend against it into `e2e/.build` and serves it on port 7690. The first run takes a few minutes.
Leave both running (`node e2e/start-backend.js`, then `node e2e/start-frontend.js`) and reruns reuse them.

Useful flags: `npx playwright test hotels` (one file), `--project=mobile`, `--ui`, `--headed`.
A failed test leaves a trace in `e2e/.results`; open it with `npx playwright show-trace <path>`. In CI each browser is its own
job, and its report and traces are uploaded as the `playwright-report-<browser>` artifact.

## How the tests are written

- `auth.setup.js` signs each seeded account in `settings.js` (admin, owner, staff, guest, and one notifications inbox per
  browser) in through the real email-code flow once, reading the code from the database, and saves the session. Specs pick
  one with `test.use({ storageState: authFile('owner') })`.
- Elements are found by what a user sees: role, label, placeholder or text. Helpers in `helpers.js` cover the app's quirks
  (toasts, lists that render a mobile and a desktop copy of each row, cards opened with their Open button).
- Anything that leaves the building is stubbed, and nothing else is:
  - LLM calls (hotel onboarding's Google Places lookup and extraction, menu photo reading, reservation document reading) are
    answered by `answerApi`.
  - Browser uploads to presigned S3 URLs are answered by `stubS3`; `stubS3(page, { status: 500 })` makes them fail.
  - The concierge's socket.io server is replaced by `fakeConcierge`, which answers every message with `conciergeReply(text)` and
    records what the page sent.
  - Backend errors are simulated with `failApi`; pass `{ method: 'POST' }` (or another method) to fail only that call and let
    the page still load what it shows.
  - The clipboard is replaced by `fakeClipboard`, since each browser guards the real one differently; a denied microphone
    is simulated with `page.addInitScript`.
- Known error paths are tested where a user can reach them. Page checks that the browser's own form validation always
  stops first (a blank required field) can't be reached, so they aren't tested.
- Two things are not driven: Google's sign-in button, which is Google's own frame (its return page is tested), and spoken
  audio, since test browsers have no microphone (what reaches the voice concierge is checked instead).
- What the UI cannot reach is set up in the database with `sql` (an accepted member invite, a reservation document on a
  booking, a notification), and emailed links are signed with `signToken`, using the test backend's fixed `JWT_SECRET`.
- Tests that create data use `unique()` names or work on a hotel they onboard themselves, so they can run in parallel and in
  any order, in every browser at once. Tests that change something seeded change their own copy instead (a request, a
  notifications account per browser), and the rest only read seeded rows.
- Each interaction is tested once. A test that needs an item first (a hotel, a room, a booking) creates it with a shared step
  rather than repeating the "create" test.
- A known app bug is written as the intended behaviour with `test.fail`, as the backend suites do with `test.failing`: it
  passes while the bug is open and fails once it is fixed, which is the cue to switch it back to `test`. A bug that only
  shows in some runs (a race) can do neither reliably, so its test is `test.fixme` (skipped), with the reason beside it.
- `*.mobile.spec.js` run on a phone-sized screen (the `mobile` project); everything else in each desktop browser.
