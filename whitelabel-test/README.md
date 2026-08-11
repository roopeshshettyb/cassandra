# White-label test presets

Each `<brand>.env` + `<brand>.constants.json` pair holds the values needed to
rebrand the app. To apply a preset:

1. Copy the block from `<brand>.env` into `.env.docker` (replace the
   `# --- White-label test: ... ---` section at the bottom).
2. Copy the matching keys from `<brand>.constants.json` into
   `frontend/src/constants.json` (update `APP_NAME`, `DESCRIPTION`,
   `PROD_FRONTEND_URL`, `CALENDLY_DEMO_URL` — leave other keys as-is).
3. Rebuild and restart:
   ```bash
   docker-compose up -d --build frontend backend
   ```
4. Verify:
   - Frontend: http://localhost:7678 (title/hero should show the new name)
   - Backend: http://localhost:7676/constants/public (`APP_NAME` should match)

To add a new brand, copy `jessie.env` and `jessie.constants.json` to
`<brand>.env` / `<brand>.constants.json` and fill in the new values.
