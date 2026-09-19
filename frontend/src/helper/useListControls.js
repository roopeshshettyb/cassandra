import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import request from './api';

const SEARCH_DEBOUNCE_MS = 350;

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
 * Server-side filtering and sorting for a list endpoint. The list is unpaged: one request brings
 * back every matching row and the page scrolls normally, which is how these lists behaved before
 * the filters were added. Every change goes through `load` with the next state, so pages need no
 * effect keyed on filters or sort. Filter state is mirrored into the querystring (replaced, not
 * pushed, so the back button still leaves the page) to survive reloads.
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

  const load = useCallback(
    async (next = {}, isBackground = false) => {
      const state = { ...currentRef.current, ...next };
      currentRef.current = state;
      setFilters(state.filters);
      setSort(state.sort);
      setSearch(state.search);

      const values = { ...state.filters, ...state.sort };
      if (searchKey) values[searchKey] = state.search;
      const params = toParams(values);

      // Keep unrelated params already on the route; drop ours once they go empty.
      setSearchParams((previous) => {
        const merged = new URLSearchParams(previous);
        ownKeys.forEach((key) => merged.delete(key));
        params.forEach((value, key) => merged.set(key, value));
        return merged;
      }, { replace: true });

      const requestId = ++requestRef.current;
      const response = await request({
        endpoint: `${endpoint}?${params}`,
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
      setData(rows);
      setTotal(response.meta?.total ?? rows.length);
    },
    [endpoint, searchKey, setLoading, alertError, setSearchParams],
  );

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

  const refetch = (isBackground) => load({}, isBackground);

  return { data, total, filters, sort, search, onFilterChange, onSearchChange, onSortChange, refetch };
}

export default useListControls;
