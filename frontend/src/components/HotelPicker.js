import { Autocomplete, TextField } from '@mui/material';

/** Searchable hotel field. `value` and `onChange` use the hotel id as a string. */
function HotelPicker({ hotels, value, onChange, required, sx }) {
  const selected = hotels.find((hotel) => String(hotel.id) === String(value)) || null;
  return (
    <Autocomplete
      options={hotels}
      value={selected}
      onChange={(_, hotel) => onChange(hotel ? String(hotel.id) : '')}
      getOptionLabel={(hotel) => hotel.name}
      getOptionKey={(hotel) => hotel.id}
      sx={sx}
      // Above the fixed mobile header (z-index 1400).
      slotProps={{ popper: { sx: { zIndex: 1400 } } }}
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
