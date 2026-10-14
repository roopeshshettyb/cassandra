# Backend tests

| Where | What | Run |
|---|---|---|
| `api/` | HTTP and Socket.IO against a database. Starts the backend itself unless one is already running. Settings come from `test.env` (git-ignored, local Postgres), then `dev.env` (`api/env.ts`), with placeholder AWS keys so no call reaches the real bucket; a database that is not on localhost is refused. Each suite tags what it creates and deletes it afterwards. | `npm run test:api` |
| `unit/` | One folder per area, as in `src/`. No server or database: dependencies are mocked. | `npm run test:unit` |
| `llm-regression/` | The concierge's answers, with real model calls. | `npm run test:llm` |

## What keeps every API covered

- The API suites test each route's happy path and known errors over HTTP, plus ownership across hotels and the sockets. `api/access.api.test.ts` covers the routes `api.test.ts` and `rooms.api.test.ts` do not reach.
- `unit/routes.spec.ts` lists every route with its access rule (public, signed in, admin only, integration token). A new route or controller fails it until it is listed.
- `unit/` keeps only what the API suites cannot reach or do not show: transactions and rollbacks, retries on conflict, pricing and date maths, notifications sent, and calls to outside services (Google Maps, Tavily, OpenAI, S3 downloads). A case an API suite already proves does not get a unit test too.

## Known problems

Each is written as the intended rule with `test.failing`: it passes while the problem is open and fails once it is fixed, which is the cue to drop `.failing`.

| Problem | Test |
|---|---|
| `POST /accounts` needs no sign-in and accepts `role`, so anyone can create an admin. `GET /accounts/count?filter=` needs no sign-in, passes the filter to Sequelize, and answers 500 for a malformed one. | `unit/routes.spec.ts`, `api/access.api.test.ts` |
| `GET /costs/by-hotel/:id` and `/costs/by-booking/:id` check no ownership. | `api/access.api.test.ts` |
| `POST /hotels/onboarding/finalize` skips the add-hotel check, so staff can overwrite the hotel at an address. | `api/access.api.test.ts` |
| `POST /notifications/register-device` skips validation and accepts an empty token. | `api/access.api.test.ts` |
| Sign-in failures (wrong or missing OTP, missing or unknown auth type, missing email) are plain `Error`s, so the API answers 500. Branch `fix/oauth-error-codes` addresses this. | `api/access.api.test.ts` |
| `/costs/aggregate` narrows owners to their hotels but not staff. | `unit/costs/costs.service.spec.ts` |
| `DELETE /hotels/:id/images` deletes whatever S3 key the URL names. | `unit/hotels/hotels.service.spec.ts` |
| `PATCH /hotels/brands/:id` is open to any member of a brand hotel, and `propagate` rewrites every hotel of the brand. | `unit/hotels/onboarding.service.spec.ts` |
| A guest can `PATCH` and `DELETE` their own booking. | `unit/bookings/bookings.service.spec.ts` |
| Staff can manage `/organisation-users` like an owner, including promoting themselves. | `unit/organisations/organisations.service.spec.ts` |
| The dashboard counts a cancelled request as open on its hotel row. | `unit/dashboard/dashboard.service.spec.ts` |

Rules that would change shared data while the problem is open (a guest deleting a booking, staff promoting themselves) are unit tests, so they cannot break the API suites.
