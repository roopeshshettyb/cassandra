---
paths:
  - "src/**/*.{js,jsx,ts,tsx}"
---

# State

- Only one `useEffect` per page, with `[]` dependencies. Anything else: **ask first**.
- Use only the shared `loading`/`setLoading`. Don't create new loading states.
- Alerts go through the common toast (`alertSuccess`/`alertError` props). Don't import `toast` or use `alert()`.
