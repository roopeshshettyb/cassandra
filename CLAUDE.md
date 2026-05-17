# Project Rules

## General
1. Always do backend first, then do frontend
2. Start the server and verify your changes for both frontend and backend
3. Defaults are only allowed in `constants.service.ts`. For ANY variable read from constants, no defaults should be set in code
4. Focus on writing less code
5. Don't use `as any` anywhere — use only `: any`
6. Never commit API keys, JWT tokens, or credentials to `.claude/settings.json` or `settings.local.json` — these files are git-tracked

## Backend (`backend/`)
1. All strings should be in constants service. If read from env, put in private constants. No defaults in code — if any default it should be in private constants itself
2. Every API needs to be secure. Ownership must be verified
3. Update `seed.ts` with proper seeding for every model with ample data
4. Run build and ensure no issues
5. Standard response structure for all APIs: `{ success, message, data }`
6. Avoid `map`, `forEach` at all costs. Only use good old `for` loops ONLY IF ABSOLUTELY NECESSARY
7. `ApiService` is for JSON API calls only. For binary downloads (`responseType: 'arraybuffer'`), use `axios` directly and type the response variable explicitly (e.g. `response: { data: ArrayBuffer; headers: any }`)

## Frontend (`frontend/`)
1. `api.js` must be used for ALL API calls. Never use raw `fetch` or `axios` directly — `api.js` handles loading, notifications, auth headers, and error handling. Always pass loaders to allow it to handle loading. Let the backend return messages so `api.js` handles alerts. Use `setData` to directly set state
2. Raw `fetch` is only acceptable for direct S3 PUT uploads (presigned URLs) since these go to S3 directly, not the backend
3. Common toast should be used for alerts
4. `MapComponent` should be used to render multiple items
5. This is an SPA — the back button at top right should work
6. All designs should be responsive
12. Never use hardcoded pixel values for spacing/padding/margins that relate to layout dimensions (bottom nav height, header height, screen sections). Use `vh`, `dvh`, `svh`, `%`, or MUI spacing units (`1` = 8px relative). Hardcoded px is only acceptable for fixed UI elements (borders, icon sizes, border-radius). For bottom nav offset use `env(safe-area-inset-bottom)` + percentage/dvh.
7. Buttons and action visibility should be as per permissions
8. All styling should come from theme ONLY
9. Run build and ensure no issues
10. Only one `useEffect` per page with dependencies as `[]`. If doing otherwise, ask first
11. Only use `loading`/`setLoading` for loading states — do not create new loading states
