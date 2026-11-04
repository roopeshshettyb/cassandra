# Backend tests (see `test/README.md`)

- `test/api/` (`npm run test:api`): HTTP and socket tests against a local database. For every route, cover the happy path, known errors and ownership (outsider, wrong role, guest). Tag what you create and delete it afterwards.
- `test/unit/` (`npm run test:unit`): mocked, for what API tests can't show (transactions, retries, date and price maths, outside services). Don't repeat a case an API test already proves.
- Add every new route to `test/unit/routes.spec.ts` with its access rule.
- Known problems are written as `test.failing` and listed in `test/README.md`. When you fix one, drop `.failing` and remove its row.
