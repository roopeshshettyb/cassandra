# Write good code

1. Do the backend first, then the frontend.
2. Start the servers and verify your change end to end, on both backend and frontend, before calling it done.
3. Write less code. Reuse existing helpers, components and patterns, and don't add code for cases that can't happen.

- Defaults are only allowed in the backend's `constants.service.ts`. Never add a fallback to a constants value in code (no `constants.X || 'foo'`, no `?? 10`).
- Never use `as any`. If you must, annotate with `: any` instead (`const values: any = dto;`).
