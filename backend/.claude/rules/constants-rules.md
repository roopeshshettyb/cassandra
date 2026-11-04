# Constants

- Enums, statuses, labels, limits and the `PERMISSIONS` matrix live in `ConstantsService` (`src/common/constants/constants.service.ts`). Import them instead of redefining them.
- All strings go in `ConstantsService`. Env values go in `private`. Values the frontend needs go in `public`; after changing them, run `npm run fetch-constants` in `frontend/`.
