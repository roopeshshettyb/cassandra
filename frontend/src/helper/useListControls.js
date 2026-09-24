import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import request from './api';

const SEARCH_DEBOUNCE_MS = 350;
// Rows per request. The list appends as you scroll, so this is a chunk size rather than a page
// anyone sees or navigates to. The server caps anything larger at LIST_PAGE_SIZE_MAX.
const CHUNK_SIZE = 20;

// Multi-select filters travel as one comma-separated param, matching what the DTOs parse.
function toParams(values) {
  const params = new URLSearchParams();
  Object.keys(values).forEach((key) => {
    const value = values[key];
    if (value == null || value === '') return;
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(','));
      return;
    }
    params.set(key, value);
  });
  return params;
}

/**
 * Server-side filtering and sorting for a list endpoint, with the rows loaded in chunks as the
 * user scrolls. Changing a filter, search or sort starts again from the first chunk; `loadMore`
 * appends the next one. Every change goes through `load` with the next state, so pages need no
 * effect keyed on filters or sort. Filter state is mirrored into the querystring (replaced, not
 * pushed, so the back button still leaves the page) to survive reloads; the chunk cursor is not,
 * since it is a scroll position rather than something worth restoring from a link.
 */
function useListControls({ endpoint, setLoading, alertError, searchKey, filterConfigs = [], sortOptions = [] }) {
  const [searchParams, setSearchParams] = useSearchParams();
  // `page` is not a control any more, but it is still listed so a link saved back when the list
  // paged gets the stale param cleared from the address bar rather than carrying it around.
  const ownKeys = [...filterConfigs.map((config) => config.key), 'sortBy', 'sortOrder', 'page', searchKey].filter(Boolean);

  const initial = useRef({
    // A multi-select holds an array; a single select holds '' for "no filter". Values the config
    // does not offer are dropped: the server rejects them, and on a multi-select an unknown value
    // would stick in the array and keep every later request failing.
    filters: Object.fromEntries(filterConfigs.map(({ key, multiple, options = [] }) => {
      const allowed = new Set(options.map((option) => option.value));
      const raw = searchParams.get(key);
      const picked = raw ? raw.split(',').filter((value) => allowed.has(value)) : [];
      return [key, multiple ? picked : picked[0] ?? ''];
    })),
    sort: (() => {
      // Same rule as the filters: honour the querystring only where it names a sort the page
      // offers, so a stale link falls back to the first option instead of failing validation.
      const fromUrl = { sortBy: searchParams.get('sortBy'), sortOrder: searchParams.get('sortOrder') };
      const offered = sortOptions.some(
        ({ value }) => value.sortBy === fromUrl.sortBy && value.sortOrder === fromUrl.sortOrder,
      );
      return offered ? fromUrl : { ...sortOptions[0]?.value };
    })(),
    search: (searchKey && searchParams.get(searchKey)) || '',
  }).current;

  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState(initial.filters);
  const [sort, setSort] = useState(initial.sort);
  const [search, setSearch] = useState(initial.search);

  // Latest state for `load`, so it is not rebuilt per keystroke and restart the debounce.
  const currentRef = useRef(initial);
  const debounceRef = useRef(null);
  const requestRef = useRef(0);
  // Mirrors of the rows and count, so `loadMore` can decide without depending on render state.
  const rowsRef = useRef([]);
  const totalRef = useRef(0);
  const chunkRef = useRef(1);
  // A plain flag, not state: two chunks must never be in flight at once, and the spec says the
  // page owns `loading`.
  const appendingRef = useRef(false);

  const load = useCallback(
    async (next = {}, isBackground = false, append = false, keepLoaded = false) => {
      const state = { ...currentRef.current, ...next };
      currentRef.current = state;
      setFilters(state.filters);
      setSort(state.sort);
      setSearch(state.search);

      const values = { ...state.filters, ...state.sort };
      if (searchKey) values[searchKey] = state.search;
      const params = toParams(values);
      // The address bar carries the filters only; page and pageSize ride along on the request.
      const chunk = append ? chunkRef.current + 1 : 1;
      // A refresh re-asks for everything already on screen in one go, so a background reload does
      // not yank a reader back to the first chunk. Anything else starts from one chunk again.
      const size = !append && keepLoaded ? Math.max(CHUNK_SIZE, rowsRef.current.length) : CHUNK_SIZE;
      const requestParams = toParams({ ...values, page: chunk, pageSize: size });

      // Keep unrelated params already on the route; drop ours once they go empty.
      setSearchParams((previous) => {
        const merged = new URLSearchParams(previous);
        ownKeys.forEach((key) => merged.delete(key));
        params.forEach((value, key) => merged.set(key, value));
        return merged;
      }, { replace: true });

      const requestId = ++requestRef.current;
      const response = await request({
        endpoint: `${endpoint}?${requestParams}`,
        method: 'GET',
        setLoading: isBackground ? null : setLoading,
        alertError,
        delay: false,
      });

      // A slower earlier request must not overwrite the newest one's rows.
      if (requestId !== requestRef.current) return;
      // `request` returns null when the call failed; it has already alerted. Keep the rows on
      // screen rather than rendering a failure as "No results" — a background refresh has no
      // spinner, so an emptied list would look like the data itself had gone.
      if (response == null) return;
      const rows = response.data ?? [];
      rowsRef.current = append ? rowsRef.current.concat(rows) : rows;
      totalRef.current = response.meta?.total ?? 0;
      // Derive the cursor from what is actually held, so a refresh that pulled several chunks in
      // one request still asks for the right next one. A short chunk only ever means the last one.
      chunkRef.current = Math.max(1, Math.ceil(rowsRef.current.length / CHUNK_SIZE));
      setData(rowsRef.current);
      setTotal(totalRef.current);
    },
    [endpoint, searchKey, setLoading, alertError, setSearchParams],
  );

  /**
   * Asks for the next chunk. Runs as a background load so the page-level spinner never covers a
   * list the user is already reading, and refuses to stack requests or run past the last row.
   */
  const loadMore = useCallback(async () => {
    if (appendingRef.current || rowsRef.current.length >= totalRef.current) return;
    appendingRef.current = true;
    try {
      await load({}, true, true);
    } finally {
      appendingRef.current = false;
    }
  }, [load]);

  // The hook's only effect: initial load, and clearing a pending debounce on unmount.
  useEffect(() => {
    load();
    return () => clearTimeout(debounceRef.current);
  }, []);

  const onFilterChange = (key) => (event) => load({ filters: { ...currentRef.current.filters, [key]: event.target.value } });

  const onSearchChange = (event) => {
    const { value } = event.target;
    setSearch(value);
    currentRef.current.search = value;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load({ search: value }), SEARCH_DEBOUNCE_MS);
  };

  const onSortChange = (event) => load({ sort: JSON.parse(event.target.value) });

  const refetch = (isBackground) => load({}, isBackground, false, true);

  return { data, total, hasMore: data.length < total, loadMore, filters, sort, search, onFilterChange, onSearchChange, onSortChange, refetch };
}

export default useListControls;
