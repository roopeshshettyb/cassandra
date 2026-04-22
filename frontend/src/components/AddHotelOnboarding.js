import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  Autocomplete,
  CircularProgress,
  LinearProgress,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import request from '../helper/api';
import { NAVY, MUTED, BRAND_GRADIENT, PRIMARY_CONTRAST } from '../theme';

function AddHotelOnboarding({ open, onClose, onHotelCreated, alertError, alertSuccess }) {
  const [step, setStep] = useState('search');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [manualWebsite, setManualWebsite] = useState('');
  const [extractedData, setExtractedData] = useState(null);
  const [finalizing, setFinalizing] = useState(false);
  const searchTimerRef = useRef(null);
  const justSelectedRef = useRef(false);

  useEffect(() => {
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, []);

  const handleInputChange = (_, value) => {
    if (justSelectedRef.current) { justSelectedRef.current = false; return; }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!value || value.length <= 2) { setSuggestions([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      const response = await request({
        endpoint: `/hotels/onboarding/search?query=${encodeURIComponent(value)}`,
        method: 'GET',
        setLoading,
        alertError,
      });
      if (response?.success) setSuggestions(response.data);
    }, 500);
  };

  const handleSelectPlace = async (_, value) => {
    if (!value) return;
    justSelectedRef.current = true;
    setSuggestions([]);
    setSelectedPlace(value);
    setStep('analyzing');
    const response = await request({
      endpoint: `/hotels/onboarding/analyze/${value.id}`,
      method: 'GET',
      alertError,
    });
    if (response?.success) {
      if (response.data.needsWebsite) { setStep('website-required'); }
      else { triggerExtraction(value.id); }
    } else {
      setStep('search');
    }
  };

  const triggerExtraction = async (placeId, website = null) => {
    setStep('extracting');
    const response = await request({
      endpoint: '/hotels/onboarding/extract',
      method: 'POST',
      data: { placeId, website },
      alertError,
    });

    if (response?.success) {
      setExtractedData(response.data);
      setStep('review');
    } else {
      setStep('search');
    }
  };

  const handleFinalize = async () => {
    setFinalizing(true);
    const response = await request({
      endpoint: '/hotels/onboarding/finalize',
      method: 'POST',
      data: extractedData,
      alertError,
      alertSuccess,
    });

    if (response?.success) {
      onHotelCreated();
      handleClose();
    }
    setFinalizing(false);
  };

  const handleClose = () => {
    setStep('search');
    setSuggestions([]);
    setSelectedPlace(null);
    setExtractedData(null);
    setManualWebsite('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3, mx: { xs: 2, sm: 3 } } }}>
      <DialogTitle sx={{ fontWeight: 700, color: NAVY }}>
        {step === 'review' ? 'Review Hotel Data' : 'Add New Hotel'}
      </DialogTitle>

      <DialogContent sx={{ minHeight: 300, display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence mode="wait">
          {step === 'search' && (
            <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Typography sx={{ color: MUTED, mb: 2 }}>Search for the hotel to begin onboarding.</Typography>
              <Autocomplete
                options={suggestions}
                getOptionLabel={(option) => `${option.name} - ${option.address}`}
                filterOptions={(x) => x}
                onInputChange={handleInputChange}
                onChange={handleSelectPlace}
                loading={loading}
                renderInput={(params) => (
                  <TextField {...params} fullWidth label="Search Hotel Name or Address" variant="outlined" />
                )}
              />
            </motion.div>
          )}

          {step === 'analyzing' && (
            <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', margin: 'auto', padding: '40px 0' }}>
              <CircularProgress size={40} sx={{ mb: 2 }} />
              <Typography variant="h6">Analyzing Map Data...</Typography>
              <Typography sx={{ color: MUTED }}>Fetching address and contact info.</Typography>
            </motion.div>
          )}

          {step === 'website-required' && (
            <motion.div key="website" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Typography sx={{ color: MUTED, mb: 2 }}>
                We couldn't find a website for <strong>{selectedPlace?.name}</strong>.
                Please enter it manually to allow our AI agent to crawl for operating hours and brand details.
              </Typography>
              <TextField
                fullWidth
                label="Hotel Website URL"
                value={manualWebsite}
                onChange={(e) => setManualWebsite(e.target.value)}
                placeholder="https://www.hotelwebsite.com"
                sx={{ mb: 2 }}
              />
              <Button
                variant="contained"
                fullWidth
                onClick={() => triggerExtraction(selectedPlace.id, manualWebsite)}
                disabled={!manualWebsite}
              >
                Start AI Analysis
              </Button>
            </motion.div>
          )}

          {step === 'extracting' && (
            <motion.div key="extracting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ width: '100%', margin: 'auto', padding: '40px 0' }}>
              <Box sx={{ width: '100%', textAlign: 'center' }}>
                <Typography variant="h6" sx={{ mb: 1 }}>Samantha is crawling the website...</Typography>
                <LinearProgress sx={{ height: 10, borderRadius: 5, mb: 2 }} />
                <Typography sx={{ color: MUTED }}>Extracting operating hours, brand identity, and theme colors.</Typography>
              </Box>
            </motion.div>
          )}

          {step === 'review' && extractedData && (
            <motion.div key="review" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card variant="outlined" sx={{ mb: 2, borderRadius: 2, bgcolor: '#f8f9fa' }}>
                <CardContent sx={{ pb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ color: 'primary.main', fontWeight: 700, mb: 0.5 }}>IDENTITY & BRAND</Typography>
                      <Typography variant="h6" sx={{ color: NAVY, lineHeight: 1.2, mb: 0.5 }}>{extractedData.name}</Typography>
                      <Typography variant="body2" sx={{ color: MUTED, mb: 1 }}>{extractedData.address}</Typography>
                    </Box>
                    {extractedData.themeConfig?.primaryColor && (
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: extractedData.themeConfig.primaryColor, border: '2px solid white', boxShadow: 1 }} title="Primary Color" />
                        {extractedData.themeConfig?.secondaryColor && (
                          <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: extractedData.themeConfig.secondaryColor, border: '2px solid white', boxShadow: 1 }} title="Secondary Color" />
                        )}
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <Box sx={{ px: 1.5, py: 0.5, bgcolor: '#e3f2fd', borderRadius: 10, fontSize: 11, fontWeight: 700, color: '#1976d2' }}>
                      {extractedData.brandName || 'Independent'}
                    </Box>
                    {extractedData.brandFound && (
                      <Box sx={{ px: 1.5, py: 0.5, bgcolor: '#e8f5e9', borderRadius: 10, fontSize: 11, fontWeight: 700, color: '#2e7d32' }}>
                        Brand Template Matched
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>

              <Box sx={{ mb: 2, px: 1 }}>
                <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
                  <DataField label="Website" value={extractedData.website} />
                  <DataField label="Phone" value={extractedData.phoneNumber} />
                </Box>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="subtitle2" sx={{ color: 'primary.main', fontWeight: 700, mb: 1.5 }}>OPERATING HOURS</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <DataField label="Check-in" value={extractedData.checkInTime} />
                  <DataField label="Check-out" value={extractedData.checkOutTime} />
                  <DataField label="Pool" value={extractedData.poolHours} />
                  <DataField label="Gym" value={extractedData.gymHours} />
                  <DataField label="Restaurant" value={extractedData.restaurantHours} />
                  <DataField label="Wifi Password" value={extractedData.wifiPassword} />
                  <DataField label="Breakfast" value={extractedData.breakfastHours} />
                  <DataField label="Lunch" value={extractedData.lunchHours} />
                  <DataField label="Dinner" value={extractedData.dinnerHours} />
                </Box>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} sx={{ color: MUTED }}>Cancel</Button>
        {step === 'review' && (
          <Button
            onClick={handleFinalize}
            variant="contained"
            disabled={finalizing}
            sx={{ background: BRAND_GRADIENT, color: PRIMARY_CONTRAST, px: 4 }}
          >
            {finalizing ? 'Onboarding...' : 'Confirm & Save'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function DataField({ label, value }) {
  const display = label === 'Website' && value
    ? (() => { try { return new URL(value).hostname; } catch { return value; } })()
    : value;
  return (
    <Box>
      <Typography sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase' }}>{label}</Typography>
      <Typography sx={{ fontSize: 13, color: NAVY, fontWeight: 500 }}>{display || 'Not found'}</Typography>
    </Box>
  );
}

export default AddHotelOnboarding;
