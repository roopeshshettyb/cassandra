# API calls: only through `src/helper/api.js`

- Use `request({...})` for every backend call. Never call `fetch` or `axios` directly.
- Always pass `setLoading`. Use `setData`/`defaultData` to set state directly. Pass `alertSuccess`/`alertError`, and let the backend's `message` be the text:
  ```js
  request({ endpoint: `/rooms?hotelId=${hotelId}`, method: 'GET', setLoading, setData: setRooms, defaultData: [], alertError });
  ```
- The only exception is a raw `fetch` PUT straight to S3 with a presigned URL.
