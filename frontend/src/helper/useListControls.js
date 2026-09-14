import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import request from './api';

const SEARCH_DEBOUNCE_MS = 350;

function toParams(values) {
  const params = new URLSearchParams();
  Object.keys(values).forEach((key) => {
    if (values[key] !== '' && values[key] != null) params.set(key, values[key]);
  });
  return params;
}

/**
 * Server-side filtering, sorting and paging for a list endpoint. Every change goes through
 * `load` with the next state, so pages need no effect keyed on filters/sort/page. Changing a
 * filter, search or sort resets to page 1; changing page keeps them. State is mirrored into the
 * querystring (replaced, not pushed, so the back button still leaves the page) to survive reloads.
 */
function useListControls({ endpoint, setLoading, alertError, pageSize, searchKey, filterKeys = [], initialSort = {} }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const ownKeys = [...filterKeys, 'sortBy', 'sortOrder', 'page', searchKey].filter(Boolean);

  const initial = useRef({
    filters: Object.fromEntries(filterKeys.map((key) => [key, searchParams.get(key) ?? ''])),
    sort: {
      sortBy: searchParams.get('sortBy') || initialSort.sortBy,
      sortOrder: searchParams.get('sortOrder') || initialSort.sortOrder,
    },
    search: (searchKey && searchParams.get(searchKey)) || '',
    page: Number(searchParams.get('page')) || 1,
  }).current;

  const [data, setData] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: initial.page, pageSize });
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

      const values = { ...state.filters, ...state.sort, page: state.page };
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
        endpoint: `${endpoint}?${toParams({ ...values, pageSize })}`,
        method: 'GET',
        setLoading: isBackground ? null : setLoading,
        alertError,
        delay: false,
      });

      // A slower earlier request must not overwrite the newest one's rows.
      if (requestId !== requestRef.current) return;
      setData(response?.data ?? []);
      setMeta(response?.meta ?? { total: 0, page: state.page, pageSize });
    },
    [endpoint, pageSize, searchKey, setLoading, alertError, setSearchParams],
  );

  // The hook's only effect: initial load, and clearing a pending debounce on unmount.
  useEffect(() => {
    load();
    return () => clearTimeout(debounceRef.current);
  }, []);

  const onFilterChange = (key) => (event) => load({ filters: { ...currentRef.current.filters, [key]: event.target.value }, page: 1 });

  const onSearchChange = (event) => {
    const { value } = event.target;
    setSearch(value);
    currentRef.current.search = value;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load({ search: value, page: 1 }), SEARCH_DEBOUNCE_MS);
  };

  const onSortChange = (event) => load({ sort: JSON.parse(event.target.value), page: 1 });

  const onPageChange = (nextPage) => load({ page: nextPage });

  const refetch = (isBackground) => load({}, isBackground);

  // `page` is not returned: the rendered page comes from `meta`, which reflects the loaded rows.
  return { data, meta, filters, sort, search, onFilterChange, onSearchChange, onSortChange, onPageChange, refetch };
}

export default useListControls;
