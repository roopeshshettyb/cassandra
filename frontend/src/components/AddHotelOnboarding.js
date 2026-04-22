import { useState, useEffect, useRef } from 'react';
import {
  Box, Button, Dialog, DialogContent, TextField, Typography,
  Autocomplete, CircularProgress, LinearProgress, Chip, Divider,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import SearchIcon from '@mui/icons-material/Search';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import LanguageIcon from '@mui/icons-material/Language';
import PhoneIcon from '@mui/icons-material/Phone';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import request from '../helper/api';
import { NAVY, MUTED, BRAND_GRADIENT, PRIMARY_CONTRAST, NAVY_GRADIENT, SHADOW } from '../theme';

const FADE = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 } };

function HourRow({ label, value }) {
  if (!value) return null;
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75, borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
      <Typography sx={{ fontSize: 12, color: MUTED, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</Typography>
      <Typography sx={{ fontSize: 13, color: NAVY, fontWeight: 600 }}>{value}</Typography>
    </Box>
  );
}

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
    const response = await request({ endpoint: `/hotels/onboarding/analyze/${value.id}`, method: 'GET', alertError });
    if (response?.success) {
      if (response.data.needsWebsite) { setStep('website-required'); }
      else { triggerExtraction(value.id); }
    } else { setStep('search'); }
  };

  const triggerExtraction = async (placeId, website = null) => {
    setStep('extracting');
    const response = await request({ endpoint: '/hotels/onboarding/extract', method: 'POST', data: { placeId, website }, alertError });
    if (response?.success) { setExtractedData(response.data); setStep('review'); }
    else { setStep('search'); }
  };

  const handleFinalize = async () => {
    setFinalizing(true);
    const response = await request({ endpoint: '/hotels/onboarding/finalize', method: 'POST', data: extractedData, alertError, alertSuccess });
    if (response?.success) { onHotelCreated(); handleClose(); }
    setFinalizing(false);
  };

  const handleClose = () => {
    setStep('search'); setSuggestions([]); setSelectedPlace(null);
    setExtractedData(null); setManualWebsite(''); onClose();
  };

  const isReview = step === 'review';
  const primaryColor = extractedData?.themeConfig?.primaryColor;
  const secondaryColor = extractedData?.themeConfig?.secondaryColor;

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm"
      PaperProps={{ sx: { borderRadius: 4, overflow: 'hidden', mx: { xs: '4%', sm: 3 }, mt: { xs: '12vh', sm: '5vh' }, mb: { xs: '2vh', sm: '5vh' }, maxHeight: { xs: '86vh', sm: '90vh' }, display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' } }}>

      {/* Header */}
      <Box sx={{ background: NAVY_GRADIENT, px: 3, pt: 3, pb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, background: BRAND_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AutoAwesomeIcon sx={{ fontSize: 18, color: PRIMARY_CONTRAST }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 16, color: '#fff', lineHeight: 1.2 }}>
                {isReview ? 'Review Extracted Data' : 'Add New Hotel'}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', mt: 0.2 }}>
                {isReview ? 'Confirm and save hotel information' : 'AI-powered hotel onboarding'}
              </Typography>
            </Box>
          </Box>
          <Button onClick={handleClose} sx={{ color: 'rgba(255,255,255,0.5)', minWidth: 0, p: 0.5, fontSize: 18, lineHeight: 1 }}>✕</Button>
        </Box>

        {/* Step indicator */}
        {!isReview && (
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            {['search', 'analyzing', 'website-required', 'extracting'].map((s, i) => (
              <Box key={s} sx={{ flex: 1, height: 3, borderRadius: 2, bgcolor: ['search', 'analyzing', 'website-required', 'extracting'].indexOf(step) >= i ? BRAND_GRADIENT : 'rgba(255,255,255,0.15)', transition: 'all 0.3s' }} />
            ))}
          </Box>
        )}
      </Box>

      <DialogContent sx={{ p: 0, minHeight: 280, flex: 1, overflowY: 'auto' }}>
        <AnimatePresence mode="wait">

          {/* SEARCH */}
          {step === 'search' && (
            <motion.div key="search" {...FADE} transition={{ duration: 0.2 }}>
              <Box sx={{ p: 3 }}>
                <Typography sx={{ color: MUTED, fontSize: 13, mb: 2 }}>
                  Search for the hotel by name or address to begin AI-powered onboarding.
                </Typography>
                <Autocomplete
                  options={suggestions}
                  getOptionLabel={(o) => `${o.name} — ${o.address}`}
                  filterOptions={(x) => x}
                  onInputChange={handleInputChange}
                  onChange={handleSelectPlace}
                  loading={loading}
                  popupIcon={null}
                  renderOption={(props, option) => (
                    <Box component="li" {...props} sx={{ py: 1.5, px: 2 }}>
                      <LocationOnIcon sx={{ fontSize: 16, color: 'primary.main', mr: 1.5, flexShrink: 0 }} />
                      <Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{option.name}</Typography>
                        <Typography sx={{ fontSize: 11, color: MUTED }}>{option.address}</Typography>
                      </Box>
                    </Box>
                  )}
                  renderInput={(params) => (
                    <TextField {...params} fullWidth placeholder="e.g. Radisson Blu Pune Kharadi" variant="outlined"
                      InputProps={{ ...params.InputProps, startAdornment: <SearchIcon sx={{ color: MUTED, mr: 1, fontSize: 20 }} /> }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 14 } }}
                    />
                  )}
                />
              </Box>
            </motion.div>
          )}

          {/* ANALYZING */}
          {step === 'analyzing' && (
            <motion.div key="analyzing" {...FADE} transition={{ duration: 0.2 }}>
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <CircularProgress size={44} thickness={3} sx={{ mb: 2.5, color: 'primary.main' }} />
                <Typography sx={{ fontWeight: 700, fontSize: 15, color: NAVY, mb: 0.5 }}>Fetching location data</Typography>
                <Typography sx={{ color: MUTED, fontSize: 13 }}>Getting address, website and contact info from Google Maps...</Typography>
              </Box>
            </motion.div>
          )}

          {/* WEBSITE REQUIRED */}
          {step === 'website-required' && (
            <motion.div key="website" {...FADE} transition={{ duration: 0.2 }}>
              <Box sx={{ p: 3 }}>
                <Box sx={{ p: 2, bgcolor: 'rgba(212,175,55,0.08)', borderRadius: 2, border: '1px solid rgba(212,175,55,0.2)', mb: 2.5 }}>
                  <Typography sx={{ fontSize: 13, color: NAVY, fontWeight: 600 }}>Website not found on Google Maps</Typography>
                  <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.5 }}>
                    Enter the website URL for <strong>{selectedPlace?.name}</strong> so Samantha can crawl it for hotel details.
                  </Typography>
                </Box>
                <TextField fullWidth label="Hotel Website URL" value={manualWebsite}
                  onChange={(e) => setManualWebsite(e.target.value)}
                  placeholder="https://www.hotelwebsite.com"
                  sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
                <Button variant="contained" fullWidth onClick={() => triggerExtraction(selectedPlace.id, manualWebsite)}
                  disabled={!manualWebsite}
                  sx={{ borderRadius: 2, py: 1.3, fontWeight: 700, background: BRAND_GRADIENT, color: PRIMARY_CONTRAST }}>
                  Start AI Analysis
                </Button>
              </Box>
            </motion.div>
          )}

          {/* EXTRACTING */}
          {step === 'extracting' && (
            <motion.div key="extracting" {...FADE} transition={{ duration: 0.2 }}>
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Box sx={{ width: 56, height: 56, borderRadius: '50%', background: BRAND_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2.5, boxShadow: '0 4px 16px rgba(212,175,55,0.35)' }}>
                  <AutoAwesomeIcon sx={{ color: PRIMARY_CONTRAST, fontSize: 26 }} />
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: 16, color: NAVY, mb: 0.5 }}>Samantha is working...</Typography>
                <Typography sx={{ color: MUTED, fontSize: 13, mb: 2.5 }}>Crawling website and extracting hotel information</Typography>
                <LinearProgress sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(0,0,0,0.06)', '& .MuiLinearProgress-bar': { background: BRAND_GRADIENT, borderRadius: 3 } }} />
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
                  {['Operating hours', 'Brand identity', 'Theme colors'].map((t) => (
                    <Typography key={t} sx={{ fontSize: 11, color: MUTED, bgcolor: 'rgba(0,0,0,0.04)', px: 1.5, py: 0.5, borderRadius: 10 }}>{t}</Typography>
                  ))}
                </Box>
              </Box>
            </motion.div>
          )}

          {/* REVIEW */}
          {step === 'review' && extractedData && (
            <motion.div key="review" {...FADE} transition={{ duration: 0.25 }}>
              <Box sx={{ p: 3 }}>
                {/* Brand header */}
                <Box sx={{ borderRadius: 3, overflow: 'hidden', mb: 2.5, border: '1px solid rgba(0,0,0,0.07)', boxShadow: SHADOW }}>
                  <Box sx={{ background: primaryColor ? `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor || primaryColor} 100%)` : NAVY_GRADIENT, px: 2.5, py: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography sx={{ fontWeight: 800, fontSize: 17, color: '#fff', lineHeight: 1.3 }}>{extractedData.name}</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mt: 0.5 }}>
                          <LocationOnIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', flexShrink: 0, mt: 0.2 }} />
                          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>{extractedData.address}</Typography>
                        </Box>
                      </Box>
                      {primaryColor && (
                        <Box sx={{ display: 'flex', gap: 0.75 }}>
                          <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: primaryColor, border: '2px solid rgba(255,255,255,0.4)', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }} />
                          {secondaryColor && <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: secondaryColor, border: '2px solid rgba(255,255,255,0.4)', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }} />}
                        </Box>
                      )}
                    </Box>
                  </Box>
                  <Box sx={{ px: 2.5, py: 1.5, bgcolor: '#fff', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    {extractedData.brandName && (
                      <Chip label={extractedData.brandName} size="small" sx={{ fontSize: 11, fontWeight: 700, bgcolor: 'rgba(212,175,55,0.12)', color: 'primary.main', border: '1px solid rgba(212,175,55,0.25)' }} />
                    )}
                    {extractedData.brandFound && (
                      <Chip label="Brand matched ✓" size="small" sx={{ fontSize: 11, fontWeight: 700, bgcolor: 'rgba(5,150,105,0.1)', color: '#059669', border: '1px solid rgba(5,150,105,0.2)' }} />
                    )}
                    {!extractedData.brandName && (
                      <Chip label="Independent" size="small" sx={{ fontSize: 11, fontWeight: 700, bgcolor: 'rgba(0,0,0,0.05)', color: MUTED }} />
                    )}
                  </Box>
                </Box>

                {/* Contact row */}
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, mb: 2 }}>
                  {extractedData.website && (
                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: 'rgba(0,0,0,0.03)', borderRadius: 2 }}>
                      <LanguageIcon sx={{ fontSize: 16, color: 'primary.main', flexShrink: 0 }} />
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(() => { try { return new URL(extractedData.website).hostname; } catch { return extractedData.website; } })()}
                      </Typography>
                    </Box>
                  )}
                  {extractedData.phoneNumber && (
                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: 'rgba(0,0,0,0.03)', borderRadius: 2 }}>
                      <PhoneIcon sx={{ fontSize: 16, color: 'primary.main', flexShrink: 0 }} />
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: NAVY }}>{extractedData.phoneNumber}</Typography>
                    </Box>
                  )}
                </Box>

                {/* Hours */}
                <Box sx={{ bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 2, p: 2, border: '1px solid rgba(0,0,0,0.05)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <AccessTimeIcon sx={{ fontSize: 15, color: 'primary.main' }} />
                    <Typography sx={{ fontSize: 12, fontWeight: 800, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Operating Hours</Typography>
                  </Box>
                  <HourRow label="Check-in" value={extractedData.checkInTime} />
                  <HourRow label="Check-out" value={extractedData.checkOutTime} />
                  <HourRow label="Breakfast" value={extractedData.breakfastHours} />
                  <HourRow label="Lunch" value={extractedData.lunchHours} />
                  <HourRow label="Dinner" value={extractedData.dinnerHours} />
                  <HourRow label="Restaurant" value={extractedData.restaurantHours} />
                  <HourRow label="Pool" value={extractedData.poolHours} />
                  <HourRow label="Gym" value={extractedData.gymHours} />
                  <HourRow label="Room Service" value={extractedData.roomServiceHours} />
                  {!extractedData.checkInTime && !extractedData.checkOutTime && !extractedData.breakfastHours && (
                    <Typography sx={{ fontSize: 12, color: MUTED, textAlign: 'center', py: 1 }}>No hours extracted</Typography>
                  )}
                </Box>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>

      {/* Footer */}
      <Box sx={{ px: 3, py: 2, borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button onClick={handleClose} sx={{ color: MUTED, fontWeight: 600, fontSize: 13 }}>Cancel</Button>
        {step === 'review' && (
          <Button onClick={handleFinalize} variant="contained" disabled={finalizing}
            sx={{ background: BRAND_GRADIENT, color: PRIMARY_CONTRAST, px: 3.5, py: 1, borderRadius: 2, fontWeight: 700, fontSize: 13, boxShadow: '0 4px 14px rgba(212,175,55,0.35)' }}>
            {finalizing ? <><CircularProgress size={14} sx={{ mr: 1, color: 'inherit' }} />Saving...</> : 'Confirm & Save'}
          </Button>
        )}
      </Box>
    </Dialog>
  );
}

export default AddHotelOnboarding;
