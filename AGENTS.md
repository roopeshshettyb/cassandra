# Project rules

1. Do the backend first, then the frontend.
2. Start the servers and verify your change end to end before calling it done.
3. Write less code. Reuse existing helpers, components and patterns, and don't add code for cases that can't happen.

- Defaults live only in the backend's `constants.service.ts`. Never add a fallback to a constants value (no `constants.X || 'foo'`, no `?? 10`).
- Never use `as any`. If you must, use `: any` (`const values: any = dto;`).
