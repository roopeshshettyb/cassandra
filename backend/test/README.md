# Backend tests

| Folder | What | Run |
|---|---|---|
| `unit/` | One folder per area, as in `src/`. No server or database: dependencies are mocked. | `npm run test:unit` |
| `api/` | HTTP and Socket.IO against the backend and a database. Settings come from `test.env` (git-ignored, local Postgres), then `dev.env` (`api/env.ts`), with placeholder AWS keys so no call reaches the real bucket; a database that is not on localhost is refused. `npm run test:api` builds and starts the backend itself, and stops it after; one already running on the same port is used instead. Each suite tags what it creates and hard-deletes it afterwards. | `npm run test:api` |
| `llm-regression/` | The concierge's answers, with real model calls. | `npm run test:llm` |

## What keeps every API covered

- `unit/routes.spec.ts` lists every route with its access rule (public, signed in, admin only, integration token) and calls every handler. A new route or controller fails it until it is listed.
- `npm run test:unit:cov` fails when coverage of the API layer drops below the floor in `unit/jest.config.js` (95% of lines today, at 98%).
- Each service spec covers its happy paths and every error it throws. `api/` proves the same paths end to end, plus DTO validation, ownership across hotels, and the sockets.

Not run against real services: Google Maps, Tavily, OpenAI and S3 downloads (onboarding search/analyze/extract, reservation-document and menu OCR extraction). Their logic is unit tested with mocks; their refusals are API tested.

## Known problems

Each is written as the intended rule with `test.failing`: it passes while the problem is open and fails once it is fixed, which is the cue to drop `.failing`.

| Problem | Test |
|---|---|
| `POST /accounts` needs no sign-in and accepts `role`, so anyone can create an admin. `GET /accounts/count?filter=` needs no sign-in and passes the filter to Sequelize. | `unit/routes.spec.ts` |
| `GET /costs/by-hotel/:id` and `/costs/by-booking/:id` check no ownership. | `api/access.api.test.ts` |
| `POST /hotels/onboarding/finalize` skips the add-hotel check, so staff can overwrite the hotel at an address. | `unit/hotels/hotels.controller.spec.ts`, `api/access.api.test.ts` |
| `POST /notifications/register-device` skips validation and accepts an empty token. | `api/access.api.test.ts` |
| `/costs/aggregate` narrows owners to their hotels but not staff. | `unit/costs/costs.service.spec.ts` |
| `DELETE /hotels/:id/images` deletes whatever S3 key the URL names. | `unit/hotels/hotels.service.spec.ts` |
| `PATCH /hotels/brands/:id` is open to any member of a brand hotel, and `propagate` rewrites every hotel of the brand. | `unit/hotels/onboarding.service.spec.ts` |
| A guest can `PATCH` and `DELETE` their own booking. | `unit/bookings/bookings.service.spec.ts` |
| Staff can manage `/organisation-users` like an owner, including promoting themselves. | `unit/organisations/organisations.service.spec.ts` |
| Sign-in failures (wrong OTP, missing or unknown auth type, missing email) are plain `Error`s, so the API answers 500. Branch `fix/oauth-error-codes` addresses this. | `api/access.api.test.ts` |
| The dashboard counts a cancelled request as open on its hotel row. | `unit/dashboard/dashboard.service.spec.ts` |
| `SampleModule` is not imported anywhere, so `/sample` does not exist at runtime. | `unit/routes.spec.ts` |

Rules that would change shared data while the problem is open (a guest deleting a booking, staff promoting themselves) are unit tests, so they cannot break the API suites.
