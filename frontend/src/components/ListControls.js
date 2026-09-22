import React from 'react';
import { Box, Checkbox, ListItemText, MenuItem, TextField } from '@mui/material';
import MapComponent from './MapComponent';
import { filterKeysOf } from '../helper/useListControls';
import { inputSx } from './cards/AppCards';

// inputSx sizes the input at 13px but leaves the label at the theme default (17.6px). MUI cuts the
// outline notch from the input's font, so the gap comes out too small and the border draws straight
// through the tail of a long label. Sizing the label off the same 13px makes the two line up.
const controlSx = { ...inputSx, '& .MuiInputLabel-root': { fontSize: 13 } };

/**
 * One filter control, built from the config the backend derived from its model: a dropdown when the
 * filter has options, a typed box otherwise. A multi-select has no "All" item — an empty selection
 * already means every value.
 */
function FilterControl({ data: config, values, onFilterChange }) {
  const sx = {
    ...controlSx,
    minWidth: 150,
    flex: { xs: '1 1 100%', sm: '0 1 auto' },
    maxWidth: { xs: '100%', sm: 220 },
    '& .MuiSelect-select': { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  };
  const selected = values[config.key] ?? (config.multiple ? [] : '');

  if (!config.options) {
    const isDate = config.type === 'date';
    return (
      <TextField
        size="small"
        type={isDate ? 'date' : 'text'}
        // A range's two inputs share one config, so the bound says which end this one is.
        label={isDate ? `${config.label} ${config.bound}` : config.label}
        value={selected}
        onChange={onFilterChange(config.key)}
        InputLabelProps={{ shrink: true }}
        sx={sx}
      />
    );
  }

  const labelFor = (value) => config.options.find((option) => option.value === value)?.label ?? value;

  return (
    <TextField
      select
      size="small"
      label={config.label}
      value={selected}
      onChange={onFilterChange(config.key)}
      sx={sx}
      InputLabelProps={{ shrink: true }}
      SelectProps={{
        multiple: !!config.multiple,
        // Without displayEmpty MUI renders an empty single select as blank, so an unset filter
        // would read differently here than on a multi-select. Both say "All".
        displayEmpty: true,
        // MUI's select menu centres itself over the field and grows to its widest option, which
        // pushes a long list left off the content column. Pin it under the field and cap it.
        MenuProps: {
          variant: 'menu',
          anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
          transformOrigin: { vertical: 'top', horizontal: 'left' },
          PaperProps: { sx: { maxHeight: 320, maxWidth: 320 } },
        },
        renderValue: (chosen) => {
          if (config.multiple) return chosen.length === 0 ? 'All' : chosen.map(labelFor).join(', ');
          return chosen === '' ? 'All' : labelFor(chosen);
        },
      }}
    >
      {!config.multiple && <MenuItem value="">All</MenuItem>}
      {config.options.map((option) => (
        <MenuItem key={option.value} value={option.value} title={option.label}>
          {config.multiple && <Checkbox size="small" sx={{ p: 0, mr: 1 }} checked={selected.includes(option.value)} />}
          <ListItemText primaryTypographyProps={{ fontSize: 14, noWrap: true }} primary={option.label} />
        </MenuItem>
      ))}
    </TextField>
  );
}

/**
 * Search and filter chrome for a server-driven list. It knows nothing about any particular list:
 * pass the whole `useListControls` result and it renders the controls the backend described.
 */
function ListControls({ list, right }) {
  const { filterConfigs = [], searchLabel, search, filters } = list;

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 3, alignItems: 'center' }}>
      {searchLabel && (
        <TextField
          size="small"
          label={searchLabel}
          value={search}
          onChange={list.onSearchChange}
          InputLabelProps={{ shrink: true }}
          sx={{ ...controlSx, minWidth: 220, flex: { xs: '1 1 100%', sm: '1 1 220px' } }}
        />
      )}
      <MapComponent
        Component={FilterControl}
        data={filterKeysOf(filterConfigs)}
        values={filters ?? {}}
        onFilterChange={list.onFilterChange}
        showNoDataAvailable={false}
      />
      {/* A page's own control that belongs on this row, e.g. the hotels gallery/table toggle. */}
      {right}
    </Box>
  );
}

export default ListControls;
