# Frontend rules

## Constants

- Import enums, statuses, labels, limits and `PERMISSIONS` from `src/constants.json`; never redefine them. Never hand-edit it: `npm run fetch-constants` generates it.

## API calls: only through `src/helper/api.js`

- Use `request({...})` for every backend call. Never call `fetch` or `axios` directly.
- Always pass `setLoading`. Use `setData`/`defaultData` to set state directly. Pass `alertSuccess`/`alertError`, and let the backend's `message` be the text:
  ```js
  request({ endpoint: `/rooms?hotelId=${hotelId}`, method: 'GET', setLoading, setData: setRooms, defaultData: [], alertError });
  ```
- Exception: a raw `fetch` PUT to a presigned S3 URL.

## Pages

- Register pages in the `routes` array in `src/App.js` (`isProtected`, `guestRestricted`). Use the `commonProps` they receive (`account`, `loading`, `setLoading`, `alertSuccess`, `alertError`, `navigate`, `isMobile`, ...) instead of recreating them.

## State

- Only one `useEffect` per page, with `[]` dependencies. Anything else: **ask first**.
- Use only the shared `loading`/`setLoading`. Don't create new loading states.
- Alerts go through the common toast (`alertSuccess`/`alertError` props). Don't import `toast` or use `alert()`.

## Lists

- Searchable or filterable lists use `useListControls` with `<ListControls />`, as in `ManageHotels.js`.
- Render items with `MapComponent` (`<MapComponent Component={RoomRow} data={rooms} isLoading={loading} />`), not a bare `.map` in JSX. Each item arrives as the `data` prop.

## Navigation and permissions

- Every page, detail view or tab must change the URL, so the top back button (`navigate(-1)`) always works.
- Show buttons and actions only when permitted: `!!constants.PERMISSIONS.CAN_EDIT_HOTEL[account?.role]`.

## Styling

- All colours, shadows and borders come from `src/theme` (`NAVY`, `MUTED`, `BORDER`, `STATUS_*`, ...). No hex or rgba literals in components.
- Use MUI `sx`. Reuse `components/cards/AppCards.js` and `components/DetailShell.js` before building new UI.
- Everything must be responsive: MUI breakpoints (`{ xs, md }`) and `isMobile`.

## Tests (Playwright, see `e2e/README.md`)

- One `<feature>.spec.js` per page, covering every control's happy path and known errors. Extend it when you add a control.
- Sign in with `test.use({ storageState: authFile('owner') })`.
- Find elements by role, label, placeholder or text; for icon-only buttons use MUI's icon test id (`getByTestId('ArrowBackIcon')`). Don't add your own `data-testid`s. Use the helpers in `helpers.js`.
- Stub only outside calls (LLMs, Google, S3).
- Run `npm run test:e2e` (one browser: `-- --project=chromium`).
