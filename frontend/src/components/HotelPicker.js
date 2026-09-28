import { Autocomplete, Box, TextField } from '@mui/material';

/**
 * Searchable hotel field, used wherever a form starts by picking a hotel.
 *
 * A plain select lists every hotel in one tall menu that covers the form and cannot
 * be filtered; here typing a few letters narrows the list, which opens under the
 * field at a fixed height. `value` and `onChange` deal in the hotel id as a string,
 * as the selects this replaced did.
 */
function HotelPicker({ hotels, value, onChange, required, size, sx }) {
  const selected = hotels.find((hotel) => String(hotel.id) === String(value)) || null;
  return (
    <Autocomplete
      options={hotels}
      value={selected}
      onChange={(_, hotel) => onChange(hotel ? String(hotel.id) : '')}
      getOptionLabel={(hotel) => hotel.name || ''}
      isOptionEqualToValue={(option, current) => option.id === current.id}
      noOptionsText="No hotels match"
      size={size}
      sx={sx}
      ListboxProps={{ style: { maxHeight: 280 } }}
      // Above the fixed mobile header (1400), as the other menus in these forms are.
      slotProps={{ popper: { sx: { zIndex: 1400 } } }}
      // Keyed by id: two hotels can share a name, and MUI keys options by label.
      renderOption={({ key, ...optionProps }, hotel) => (
        <Box component="li" key={hotel.id} {...optionProps} title={hotel.name}>
          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {hotel.name}
          </Box>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Hotel"
          required={required}
          placeholder="Search hotels"
          InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
        />
      )}
    />
  );
}

export default HotelPicker;
