import { useState, useEffect, useMemo, useRef } from 'react';
import debounce from '@mui/utils/debounce';
import {
  Box, Button, Dialog, DialogContent, TextField, Typography,
  Autocomplete, CircularProgress, LinearProgress, Chip,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import SearchIcon from '@mui/icons-material/Search';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import LanguageIcon from '@mui/icons-material/Language';
import PhoneIcon from '@mui/icons-material/Phone';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ApartmentIcon from '@mui/icons-material/Apartment';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import request from '../helper/api';
import MapComponent from './MapComponent';
import { NAVY, MUTED, BRAND_GRADIENT, PRIMARY_CONTRAST, NAVY_GRADIENT, SHADOW, BORDER } from '../theme';

const FADE = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 } };

const HOUR_FIELDS = [
  { key: 'checkInTime', label: 'Check-in' },
  { key: 'checkOutTime', label: 'Check-out' },
  { key: 'breakfastHours', label: 'Breakfast' },
  { key: 'lunchHours', label: 'Lunch' },
  { key: 'dinnerHours', label: 'Dinner' },
  { key: 'snacksHours', label: 'Snacks' },
  { key: 'restaurantHours', label: 'Restaurant' },
  { key: 'poolHours', label: 'Pool' },
  { key: 'gymHours', label: 'Gym' },
  { key: 'roomServiceHours', label: 'Room Service' },
  { key: 'houseKeepingHours', label: 'Housekeeping' },
];

const editInputSx = {
  '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13, bgcolor: '#fff' },
  '& .MuiInputLabel-root': { fontSize: 13 },
};

// Renders one labelled editable row. Used standalone + via MapComponent for hours.
function EditRow({ data, onChange }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.6 }}>
      <Typography sx={{ flex: '0 0 38%', fontSize: 12, color: MUTED, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{data.label}</Typography>
      <TextField
        fullWidth size="small" variant="outlined"
        placeholder={data.placeholder || '—'}
        value={data.value || ''}
        onChange={(e) => onChange(data.key, e.target.value)}
        sx={editInputSx}
      />
    </Box>
  );
}

function AddHotelOnboarding({ open, onClose, onHotelCreated, alertError, alertSuccess }) {
  const [step, setStep] = useState('search');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [noResults, setNoResults] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [manualWebsite, setManualWebsite] = useState('');
  const [extractedData, setExtractedData] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const logoInputRef = useRef(null);

  const debouncedSearch = useMemo(() => debounce(async (value) => {
    const response = await request({
      endpoint: `/hotels/onboarding/search?query=${encodeURIComponent(value)}`,
      method: 'GET',
      setLoading,
      alertError,
    });
    if (response?.success) {
      setSuggestions(response.data);
      setNoResults(response.data.length === 0);
    }
  }, 500), []);

  useEffect(() => () => debouncedSearch.clear(), []);

  const handleInputChange = (_, value) => {
    if (!value || value.length <= 2) { setSuggestions([]); setNoResults(false); return; }
    debouncedSearch(value);
  };

  const handleSelectPlace = async (_, value) => {
    if (!value) return;
    debouncedSearch.clear();
    setSuggestions([]);
    setSelectedPlace(value);
    setStep('analyzing');
    const response = await request({ endpoint: `/hotels/onboarding/analyze/${value.id}`, method: 'GET', setLoading, alertError });
    if (response?.success) {
      if (response.data.brandMatch) {
        // Brand exists — skip crawl, use brand data directly
        const brandRes = await request({ endpoint: `/hotels/brands/${response.data.brandMatch.id}`, method: 'GET', setLoading, alertError });
        if (brandRes?.success) {
          setExtractedData({
            ...brandRes.data,
            name: value.name,
            address: value.address,
            website: response.data.website || null,
            phoneNumber: response.data.phoneNumber || null,
            googleMapsUrl: value.id
              ? `https://www.google.com/maps/place/?q=place_id:${value.id}`
              : (response.data.location?.lat != null ? `https://www.google.com/maps?q=${response.data.location.lat},${response.data.location.lng}` : null),
            brandName: brandRes.data.name,
            brandId: brandRes.data.id,
            brandFound: true,
          });
          setStep('review');
        } else { setStep('search'); }
      } else if (response.data.needsWebsite) {
        setStep('website-required');
      } else {
        triggerExtraction(value.id);
      }
    } else { setStep('search'); }
  };

  const triggerExtraction = async (placeId, website = null) => {
    setStep('extracting');
    const response = await request({ endpoint: '/hotels/onboarding/extract', method: 'POST', data: { placeId, website }, setLoading, alertError });
    if (response?.success) { setExtractedData(response.data); setStep('review'); }
    else { setStep('search'); }
  };

  const handleFinalize = async () => {
    const response = await request({ endpoint: '/hotels/onboarding/finalize', method: 'POST', data: extractedData, setLoading, alertError, alertSuccess });
    if (!response?.success) return;
    const hotelId = response.data?.id;
    // If a new logo file was picked, upload it via the existing hotel-logo presigned flow
    if (logoFile && hotelId) {
      try {
        const presignedRes = await request({ endpoint: `/hotels/${hotelId}/logo/presigned-url`, method: 'POST', data: { fileName: logoFile.name, fileSize: logoFile.size, contentType: logoFile.type }, throw: true });
        const { presignedUrl, s3Url } = presignedRes?.data || {};
        const s3Resp = await fetch(presignedUrl, { method: 'PUT', headers: { 'Content-Type': logoFile.type }, body: logoFile });
        if (!s3Resp.ok) throw new Error(`S3 upload failed (${s3Resp.status})`);
        await request({ endpoint: `/hotels/${hotelId}/logo`, method: 'PATCH', data: { s3Url }, throw: true });
      } catch (err) { alertError?.(`Logo upload failed: ${err.message}`); }
    }
    onHotelCreated(); handleClose();
  };

  const resetState = () => {
    setStep('search'); setSuggestions([]); setNoResults(false);
    setSelectedPlace(null); setExtractedData(null); setManualWebsite(''); setLogoFile(null);
  };

  const handleClose = () => onClose();

  const setField = (key, value) => setExtractedData((prev) => ({ ...prev, [key]: value }));
  const setColor = (key, value) => setExtractedData((prev) => ({ ...prev, themeConfig: { ...(prev?.themeConfig || {}), [key]: value } }));

  const isReview = step === 'review';
  const primaryColor = extractedData?.themeConfig?.primaryColor;
  const secondaryColor = extractedData?.themeConfig?.secondaryColor;
  const logoUrl = extractedData?.logoUrl;

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" TransitionProps={{ onExited: resetState }}
      PaperProps={{ sx: { borderRadius: 4, overflow: 'hidden', mx: { xs: '4%', sm: 3 }, mt: { xs: '12vh', sm: '5vh' }, mb: { xs: '2vh', sm: '5vh' }, maxHeight: { xs: '86vh', sm: '90vh' }, display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' } }}>

      {/* Header */}
      <Box sx={{ background: NAVY_GRADIENT, px: 3, pt: 3, pb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, background: BRAND_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ApartmentIcon sx={{ fontSize: 18, color: PRIMARY_CONTRAST }} />
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

      <DialogContent sx={{ p: 0, flex: 1, overflowY: 'auto' }}>
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
                  open={suggestions.length > 0 || noResults}
                  onClose={() => { setSuggestions([]); setNoResults(false); }}
                  noOptionsText="No results found"
                  onInputChange={handleInputChange}
                  onChange={handleSelectPlace}
                  loading={loading}
                  popupIcon={null}
                  renderOption={({ key, ...optionProps }, option) => (
                    <Box key={key} component="li" {...optionProps} sx={{ py: 1.5, px: 2 }}>
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
                <Box sx={{ position: 'relative', mx: 'auto', mb: 2.5, width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.25, 0, 0.25] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(212,175,55,0.35)' }} />
                  <motion.div animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0.1, 0.4] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                    style={{ position: 'absolute', inset: 6, borderRadius: '50%', background: 'rgba(212,175,55,0.3)' }} />
                  <Box sx={{ width: 56, height: 56, borderRadius: '50%', background: BRAND_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(212,175,55,0.5)', zIndex: 1 }}>
                    <ApartmentIcon sx={{ color: PRIMARY_CONTRAST, fontSize: 28 }} />
                  </Box>
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: 16, color: NAVY, mb: 0.5 }}>Learning your hotel...</Typography>
                <Typography sx={{ color: MUTED, fontSize: 13, mb: 2.5 }}>Discovering what makes your property extraordinary</Typography>
                <LinearProgress sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(0,0,0,0.06)', '& .MuiLinearProgress-bar': { background: BRAND_GRADIENT, borderRadius: 3 } }} />
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
                  {['Daily rhythm', 'Brand essence', 'Guest experience'].map((t) => (
                    <Typography key={t} sx={{ fontSize: 11, color: MUTED, bgcolor: 'rgba(0,0,0,0.04)', px: 1.5, py: 0.5, borderRadius: 10 }}>{t}</Typography>
                  ))}
                </Box>
              </Box>
            </motion.div>
          )}

          {/* REVIEW — all fields editable inline */}
          {step === 'review' && extractedData && (
            <motion.div key="review" {...FADE} transition={{ duration: 0.25 }}>
              <Box sx={{ p: 3, bgcolor: '#fff' }}>
                {/* Identity card */}
                <Box sx={{ borderRadius: 3, mb: 2, border: `1px solid ${BORDER}`, boxShadow: SHADOW, p: 2, bgcolor: '#fff' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                    {(() => {
                      const preview = logoFile ? URL.createObjectURL(logoFile) : extractedData.logoUrl;
                      return (
                        <Box sx={{ flexShrink: 0, width: 48, height: 48, borderRadius: 2, overflow: 'hidden', bgcolor: 'rgba(0,0,0,0.04)', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {preview
                            ? <Box component="img" src={preview} alt="logo" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                            : null}
                          <Box sx={{ display: preview ? 'none' : 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography sx={{ fontWeight: 900, fontSize: 18, color: MUTED, lineHeight: 1 }}>{extractedData.name?.[0]?.toUpperCase()}</Typography>
                          </Box>
                        </Box>
                      );
                    })()}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
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
                      <Button onClick={() => logoInputRef.current?.click()} size="small" startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}
                        sx={{ alignSelf: 'flex-start', textTransform: 'none', fontSize: 12, fontWeight: 700, color: 'primary.main', px: 1, py: 0.25, minWidth: 0 }}>
                        {logoFile ? 'Change logo' : 'Upload new logo'}
                      </Button>
                      <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setLogoFile(f); e.target.value = ''; }} />
                    </Box>
                  </Box>
                  <TextField fullWidth size="small" label="Hotel name" value={extractedData.name || ''} onChange={(e) => setField('name', e.target.value)} sx={{ ...editInputSx, mb: 1.25 }} />
                  <TextField fullWidth size="small" multiline maxRows={2} label="Address" value={extractedData.address || ''} onChange={(e) => setField('address', e.target.value)} sx={editInputSx} />
                </Box>

                {/* Contact + location */}
                <Box sx={{ borderRadius: 2, p: 2, mb: 2, border: `1px solid ${BORDER}` }}>
                  <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, mb: 1.5 }}>
                    <TextField fullWidth size="small" label="Website" value={extractedData.website || ''} onChange={(e) => setField('website', e.target.value)} InputProps={{ startAdornment: <LanguageIcon sx={{ fontSize: 16, color: MUTED, mr: 0.75 }} /> }} sx={editInputSx} />
                    <TextField fullWidth size="small" label="Phone" value={extractedData.phoneNumber || ''} onChange={(e) => setField('phoneNumber', e.target.value)} InputProps={{ startAdornment: <PhoneIcon sx={{ fontSize: 16, color: MUTED, mr: 0.75 }} /> }} sx={editInputSx} />
                  </Box>
                  <TextField fullWidth size="small" label="Google Maps link" value={extractedData.googleMapsUrl || ''} onChange={(e) => setField('googleMapsUrl', e.target.value)} placeholder="https://www.google.com/maps/place/..." InputProps={{ startAdornment: <LocationOnIcon sx={{ fontSize: 16, color: MUTED, mr: 0.75 }} /> }} sx={editInputSx} />
                  {extractedData.googleMapsUrl && (
                    <Box
                      component="a"
                      href={extractedData.googleMapsUrl}
                      target="_blank" rel="noopener noreferrer"
                      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 1, fontSize: 12, fontWeight: 600, color: 'primary.main', textDecoration: 'none' }}
                    >
                      <LocationOnIcon sx={{ fontSize: 14 }} /> View on Google Maps
                    </Box>
                  )}
                </Box>

                {/* Brand + colors + wifi */}
                <Box sx={{ borderRadius: 2, p: 2, mb: 2, border: `1px solid ${BORDER}` }}>
                  <TextField fullWidth size="small" label="Brand name" placeholder="Independent (leave blank)" value={extractedData.brandName || ''} onChange={(e) => setField('brandName', e.target.value || null)} sx={{ ...editInputSx, mb: 1.5 }} />
                  <TextField fullWidth size="small" label="Wifi password" value={extractedData.wifiPassword || ''} onChange={(e) => setField('wifiPassword', e.target.value)} sx={{ ...editInputSx, mb: 1.5 }} />
                  <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                    <TextField fullWidth size="small" label="Primary color" value={primaryColor || ''} onChange={(e) => setColor('primaryColor', e.target.value)} placeholder="#RRGGBB"
                      InputProps={{ startAdornment: <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: primaryColor || 'transparent', border: `1px solid ${BORDER}`, mr: 0.75, flexShrink: 0 }} /> }} sx={editInputSx} />
                    <TextField fullWidth size="small" label="Secondary color" value={secondaryColor || ''} onChange={(e) => setColor('secondaryColor', e.target.value)} placeholder="#RRGGBB"
                      InputProps={{ startAdornment: <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: secondaryColor || 'transparent', border: `1px solid ${BORDER}`, mr: 0.75, flexShrink: 0 }} /> }} sx={editInputSx} />
                  </Box>
                </Box>

                {/* Operating hours — all editable */}
                <Box sx={{ borderRadius: 2, p: 2, border: `1px solid ${BORDER}` }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <AccessTimeIcon sx={{ fontSize: 15, color: 'primary.main' }} />
                    <Typography sx={{ fontSize: 12, fontWeight: 800, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Operating Hours</Typography>
                  </Box>
                  <MapComponent
                    Component={EditRow}
                    showNoDataAvailable={false}
                    data={HOUR_FIELDS.map((f) => ({ ...f, value: extractedData[f.key] }))}
                    onChange={setField}
                  />
                </Box>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>

      {step === 'review' && (
        <Box sx={{ px: 3, py: 2, borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={handleFinalize} variant="contained" disabled={loading}
            sx={{ background: BRAND_GRADIENT, color: PRIMARY_CONTRAST, px: 3.5, py: 1, borderRadius: 2, fontWeight: 700, fontSize: 13, boxShadow: '0 4px 14px rgba(212,175,55,0.35)' }}>
            {loading ? <><CircularProgress size={14} sx={{ mr: 1, color: 'inherit' }} />Saving...</> : 'Confirm & Save'}
          </Button>
        </Box>
      )}
    </Dialog>
  );
}

export default AddHotelOnboarding;
