---
paths:
  - "e2e/**"
  - "playwright.config.js"
---

# Frontend tests (Playwright, see `e2e/README.md`)

- One `<feature>.spec.js` per page, covering every control's happy path and known errors. Extend it when you add a control.
- Sign in with `test.use({ storageState: authFile('owner') })`.
- Find elements by role, label, placeholder or text. Icon-only buttons are the exception: use MUI's icon test id (`getByTestId('ArrowBackIcon')`). Don't add your own `data-testid`s. Use the helpers in `helpers.js`.
- Stub only outside calls (LLMs, Google, S3).
- Run `npm run test:e2e` (one browser: `-- --project=chromium`).
