import { useCallback, useEffect, useRef, useState } from 'react';
import request from './api';

const SEARCH_DEBOUNCE_MS = 350;
// Every list endpoint takes the same search param, so no page has to name its own.
const SEARCH_KEY = 'search';
const EMPTY_CONFIG = { filters: [], searchLabel: null };

/**
 * The query keys behind each filter — one each, except a date, which the endpoint takes as a range:
 * `<key>From` and `<key>To`. The UI draws those as two inputs from the one config.
 */
export function filterKeysOf(filterConfigs) {
  return filterConfigs.flatMap((filter) => (filter.type === 'date'
    ? [{ ...filter, key: `${filter.key}From`, bound: 'from' }, { ...filter, key: `${filter.key}To`, bound: 'to' }]
    : [filter]));
}

// Multi-select filters travel as one comma-separated param, matching what the backend parses.
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
 * Server-side filtering and searching for a list endpoint — and the controls are server-side too:
 * `GET <endpoint>/filters` returns what this list offers, built from the `filterable` and
 * `searchable` columns on the Sequelize model. Showing a filter for a new column needs no change
 * here and none on the page.
 *
 * Every change goes through `load` with the next state, so pages need no effect keyed on filters.
 */
function useListControls({ endpoint, setLoading, alertError }) {
  const [config, setConfig] = useState(EMPTY_CONFIG);
  const [data, setData] = useState([]);
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState('');

  // Latest state for `load`, so it is not rebuilt per keystroke and restart the debounce.
  const currentRef = useRef({ filters: {}, search: '' });
  const debounceRef = useRef(null);
  const requestRef = useRef(0);

  const load = useCallback(
    async (next = {}, isBackground = false) => {
      const state = { ...currentRef.current, ...next };
      currentRef.current = state;
      setFilters(state.filters);
      setSearch(state.search);

      const params = toParams({ ...state.filters, [SEARCH_KEY]: state.search });

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
      // screen rather than rendering a failure as an empty list.
      if (response == null) return;
      setData(response.data ?? []);
    },
    [endpoint, setLoading, alertError],
  );

  // The hook's only effect: read the controls this list offers, then load the rows.
  useEffect(() => {
    (async () => {
      const response = await request({
        endpoint: `${endpoint}/filters`,
        method: 'GET',
        setLoading,
        alertError,
        delay: false,
      });
      // A failed config call has already alerted; the list still loads, just without controls.
      const nextConfig = response?.data ?? EMPTY_CONFIG;
      setConfig(nextConfig);
      // A multi-select holds an array, everything else '' for "no filter".
      const initialFilters = {};
      filterKeysOf(nextConfig.filters).forEach(({ key, multiple }) => { initialFilters[key] = multiple ? [] : ''; });
      await load({ filters: initialFilters, search: '' });
    })();
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

  const refetch = (isBackground) => load({}, isBackground);

  return {
    data,
    filterConfigs: config.filters,
    searchLabel: config.searchLabel,
    filters,
    search,
    onFilterChange,
    onSearchChange,
    refetch,
  };
}

export default useListControls;
