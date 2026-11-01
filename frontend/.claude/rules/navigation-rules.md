---
paths:
  - "src/**/*.{js,jsx,ts,tsx}"
---

# Navigation and permissions

- It's an SPA, and the top back button (`navigate(-1)`) must always work. Every page, detail view or tab the user opens must change the URL.
- Show buttons and actions only when permitted: `!!constants.PERMISSIONS.CAN_EDIT_HOTEL[account?.role]`.
