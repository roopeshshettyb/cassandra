import React from 'react';
import { Box, Checkbox, ListItemText, MenuItem, TextField, Typography } from '@mui/material';
import MapComponent from './MapComponent';
import { inputSx } from './cards/AppCards';
import { BORDER, MUTED } from '../theme';

// inputSx sizes the input at 13px but leaves the label at the theme default (17.6px). MUI cuts the
// outline notch from the input's font, so the gap comes out too small and the border draws straight
// through the tail of a long label. Sizing the label off the same 13px makes the two line up.
const controlSx = { ...inputSx, '& .MuiInputLabel-root': { fontSize: 13 } };

/**
 * One filter dropdown. `data` is a { key, label, multiple, options: [{ value, label }] } config.
 * A multi-select has no "All" item — an empty selection already means every value.
 */
function FilterSelect({ data: config, values, onFilterChange }) {
  const selected = values[config.key] ?? (config.multiple ? [] : '');
  const labelFor = (value) => config.options.find((option) => option.value === value)?.label ?? value;

  return (
    <TextField
      select
      size="small"
      label={config.label}
      value={selected}
      onChange={onFilterChange(config.key)}
      sx={{ ...controlSx, minWidth: 150, flex: { xs: '1 1 100%', sm: '0 1 auto' } }}
      InputLabelProps={{ shrink: true }}
      SelectProps={{
        multiple: !!config.multiple,
        // Without displayEmpty MUI renders an empty single select as blank, so an unset filter
        // would read differently here than on a multi-select. Both say "All".
        displayEmpty: true,
        renderValue: (chosen) => {
          if (config.multiple) return chosen.length === 0 ? 'All' : chosen.map(labelFor).join(', ');
          return chosen === '' ? 'All' : labelFor(chosen);
        },
      }}
    >
      {!config.multiple && <MenuItem value="">All</MenuItem>}
      {config.options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {config.multiple ? (
            <>
              <Checkbox size="small" sx={{ p: 0, mr: 1 }} checked={selected.includes(option.value)} />
              <ListItemText primaryTypographyProps={{ fontSize: 14 }} primary={option.label} />
            </>
          ) : option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

/**
 * Search, filter and sort chrome for a server-driven list. Purely presentational —
 * every control is wired to the handlers from useListControls.
 */
function ListControls({ filterConfigs = [], sortOptions = [], searchLabel, search, filters, sort, total = 0, onSearchChange, onFilterChange, onSortChange }) {
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
            sx={{ ...controlSx, minWidth: 220, flex: { xs: '1 1 100%', sm: '1 1 220px' } }}
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
            sx={{ ...controlSx, minWidth: 170, flex: { xs: '1 1 100%', sm: '0 1 auto' } }}
          >
            {sortOptions.map((option) => (
              <MenuItem key={option.label} value={sortKey(option.value)}>{option.label}</MenuItem>
            ))}
          </TextField>
        )}
      </Box>

      <Typography sx={{ mt: 2, pt: 2, borderTop: `1px solid ${BORDER}`, fontSize: 13, color: MUTED }}>
        {total === 0 ? 'No results' : `${total} result${total === 1 ? '' : 's'}`}
      </Typography>
    </Box>
  );
}

export default ListControls;
