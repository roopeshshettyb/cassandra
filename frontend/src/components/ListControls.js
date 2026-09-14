import React from 'react';
import { Box, Button, MenuItem, TextField, Typography } from '@mui/material';
import MapComponent from './MapComponent';
import { inputSx } from './cards/AppCards';
import { BORDER, MUTED, NAVY } from '../theme';

/** One filter dropdown. `data` is a { key, label, options: [{ value, label }] } config. */
function FilterSelect({ data: config, values, onFilterChange }) {
  return (
    <TextField
      select
      size="small"
      label={config.label}
      value={values[config.key] ?? ''}
      onChange={onFilterChange(config.key)}
      sx={{ ...inputSx, minWidth: 150, flex: { xs: '1 1 100%', sm: '0 1 auto' } }}
      InputLabelProps={{ shrink: true }}
    >
      <MenuItem value="">All</MenuItem>
      {config.options.map((option) => (
        <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
      ))}
    </TextField>
  );
}

/**
 * Search, filter, sort and paging chrome for a server-driven list. Purely presentational —
 * every control is wired to the handlers from useListControls.
 */
function ListControls({ filterConfigs = [], sortOptions = [], searchLabel, search, filters, sort, meta, isLoading, onSearchChange, onFilterChange, onSortChange, onPageChange }) {
  const pageSize = meta?.pageSize || 0;
  const total = meta?.total || 0;
  const page = meta?.page || 1;
  const lastPage = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);
  // Key order matters to JSON.stringify, so normalise both sides before comparing.
  const sortKey = (value) => JSON.stringify({ sortBy: value?.sortBy, sortOrder: value?.sortOrder });

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
        {searchLabel && (
          <TextField
            size="small"
            label={searchLabel}
            value={search}
            onChange={onSearchChange}
            InputLabelProps={{ shrink: true }}
            sx={{ ...inputSx, minWidth: 220, flex: { xs: '1 1 100%', sm: '1 1 220px' } }}
          />
        )}
        <MapComponent
          Component={FilterSelect}
          data={filterConfigs}
          values={filters ?? {}}
          onFilterChange={onFilterChange}
          showNoDataAvailable={false}
        />
        {sortOptions.length > 0 && (
          <TextField
            select
            size="small"
            label="Sort by"
            value={sortKey(sort)}
            onChange={onSortChange}
            InputLabelProps={{ shrink: true }}
            sx={{ ...inputSx, minWidth: 170, flex: { xs: '1 1 100%', sm: '0 1 auto' } }}
          >
            {sortOptions.map((option) => (
              <MenuItem key={option.label} value={sortKey(option.value)}>{option.label}</MenuItem>
            ))}
          </TextField>
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mt: 2, pt: 2, borderTop: `1px solid ${BORDER}`, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: 13, color: MUTED }}>
          {total === 0 || firstRow > total ? 'No results' : `Showing ${firstRow}–${lastRow} of ${total}`}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button size="small" variant="outlined" disabled={isLoading || page <= 1} onClick={() => onPageChange(page - 1)} sx={{ textTransform: 'none' }}>
            Previous
          </Button>
          <Typography sx={{ fontSize: 13, color: NAVY, fontWeight: 600, minWidth: 80, textAlign: 'center' }}>
            Page {page} of {lastPage}
          </Typography>
          <Button size="small" variant="outlined" disabled={isLoading || page >= lastPage} onClick={() => onPageChange(page + 1)} sx={{ textTransform: 'none' }}>
            Next
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

export default ListControls;
