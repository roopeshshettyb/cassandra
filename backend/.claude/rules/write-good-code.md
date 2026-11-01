# Write good code

1. Do the backend first, then the frontend.
2. Start the servers and verify your change end to end, on both backend and frontend, before calling it done.
3. Write less code. Reuse existing helpers, components and patterns, and don't add code for cases that can't happen.

- Enums, statuses, labels, limits and the `PERMISSIONS` matrix live in `src/common/constants/constants.service.ts`. Import them instead of redefining them.
- Defaults are only allowed in `constants.service.ts`. Never add a fallback to a constants value in code (no `constants.X || 'foo'`, no `?? 10`).
- Never use `as any`. If you must, annotate with `: any` instead (`const values: any = dto;`).
