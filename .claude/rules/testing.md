---
paths:
  - "backend/test/**"
  - "frontend/e2e/**"
  - "frontend/playwright.config.js"
---

# Testing rules

## Backend (`backend/test/`, see its `README.md`)
- `test/api/` (`npm run test:api`): HTTP and socket tests against a local database. For every route, cover the happy path, known errors and ownership (outsider, wrong role, guest). Tag what you create and delete it afterwards.
- `test/unit/` (`npm run test:unit`): mocked, for what API tests can't show (transactions, retries, date and price maths, outside services). Don't repeat a case an API test already proves.
- Add every new route to `test/unit/routes.spec.ts` with its access rule.
- Known problems are written as `test.failing` and listed in `test/README.md`. When you fix one, drop `.failing` and remove its row.

## Frontend (`frontend/e2e/`, Playwright, see its `README.md`)
- One `<feature>.spec.js` per page, covering every control's happy path and known errors. Extend it when you add a control.
- Sign in with `test.use({ storageState: authFile('owner') })`.
- Find elements by role, label, placeholder or text. Icon-only buttons are the exception: use MUI's icon test id (`getByTestId('ArrowBackIcon')`). Don't add your own `data-testid`s. Use the helpers in `helpers.js`.
- Stub only outside calls (LLMs, Google, S3).
- Run `npm run test:e2e` (one browser: `-- --project=chromium`).
