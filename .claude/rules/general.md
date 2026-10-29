# Cassandra: general rules

## Repo layout
- `backend/`: NestJS + Sequelize on Postgres. `frontend/`: React SPA with MUI, mostly JavaScript.
- `frontend/src/constants.json` is generated from the backend's `GET /constants/public` (`npm run fetch-constants`). Never hand-edit it.
- `mobile/` and `mobile-recovered/` are ignored on purpose. Never touch them.

## Workflow
1. Do the backend first, then the frontend.
2. Start the servers and verify your change end to end, on both backend and frontend, before calling it done.
3. Write less code. Reuse existing helpers, components and patterns, and don't add code for cases that can't happen.

## Constants and defaults
- Defaults are only allowed in `backend/src/common/constants/constants.service.ts`. Never add a fallback to a constants value in code (no `constants.X || 'foo'`, no `?? 10`).
- Enums, statuses, labels, limits and the `PERMISSIONS` matrix live in `constants.service.ts`. Import them instead of redefining them.

## Code style
- Never use `as any`. If you must, annotate with `: any` instead (`const values: any = dto;`).
- Format with `.prettierrc`.
