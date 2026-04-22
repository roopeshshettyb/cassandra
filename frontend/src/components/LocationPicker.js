import { useEffect, useRef, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  TextField, Typography, CircularProgress, List, ListItem, ListItemText,
} from '@mui/material';
import { loadGoogleMaps } from '../helper/maps';
import { NAVY, MUTED } from '../theme';

function LocationPicker({ open, onClose, onPlaceSelected, googleMapsApiKey }) {
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const autocompleteService = useRef(null);
  const placesService = useRef(null);
  const dummyDiv = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (open && googleMapsApiKey && !initializedRef.current) {
      setLoading(true);
      loadGoogleMaps(googleMapsApiKey)
        .then(() => {
          autocompleteService.current = new window.google.maps.places.AutocompleteService();
          placesService.current = new window.google.maps.places.PlacesService(dummyDiv.current);
          initializedRef.current = true;
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
    if (!open) {
      setQuery('');
      setSuggestions([]);
      setSelectedPlace(null);
    }
  }, []);

  const handleQueryChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setSelectedPlace(null);
    if (!value || value.length < 2 || !autocompleteService.current) { setSuggestions([]); return; }
    autocompleteService.current.getPlacePredictions(
      { input: value, types: ['lodging'] },
      (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          setSuggestions(results);
        } else {
          setSuggestions([]);
        }
      },
    );
  };

  const handleSelect = (prediction) => {
    placesService.current.getDetails(
      { placeId: prediction.place_id, fields: ['place_id', 'name', 'vicinity', 'formatted_address'] },
      (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          setSelectedPlace({ id: place.place_id, name: place.name, address: place.vicinity || place.formatted_address });
          setSuggestions([]);
          setQuery(place.name);
        }
      },
    );
  };

  const handleConfirm = () => {
    if (selectedPlace) {
      onPlaceSelected(selectedPlace);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700, color: NAVY }}>Search Hotel Location</DialogTitle>
      <DialogContent>
        <div ref={dummyDiv} style={{ display: 'none' }} />
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ position: 'relative' }}>
            <TextField fullWidth autoFocus label="Search hotel name or address" value={query} onChange={handleQueryChange} sx={{ mt: 1 }} />
            {suggestions.length > 0 && (
              <List sx={{ border: '1px solid #eee', borderRadius: 2, mt: 0.5, maxHeight: 280, overflowY: 'auto', bgcolor: 'background.paper', boxShadow: 3 }}>
                {suggestions.map((s) => (
                  <ListItem key={s.place_id} onClick={() => handleSelect(s)} sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
                    <ListItemText
                      primary={s.structured_formatting?.main_text || s.description}
                      secondary={s.structured_formatting?.secondary_text}
                      primaryTypographyProps={{ fontWeight: 600, fontSize: 14, color: NAVY }}
                      secondaryTypographyProps={{ fontSize: 12, color: MUTED }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
            {selectedPlace && (
              <Box sx={{ mt: 2, p: 2, bgcolor: '#f0f7ff', borderRadius: 2, border: '1px solid #bbdefb' }}>
                <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700 }}>SELECTED</Typography>
                <Typography sx={{ fontWeight: 700, color: NAVY }}>{selectedPlace.name}</Typography>
                <Typography variant="body2" sx={{ color: MUTED }}>{selectedPlace.address}</Typography>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} sx={{ color: MUTED }}>Cancel</Button>
        <Button onClick={handleConfirm} variant="contained" disabled={!selectedPlace} sx={{ borderRadius: 10, px: 4 }}>
          Use This Location
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default LocationPicker;
