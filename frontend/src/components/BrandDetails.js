import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, TextField, Checkbox, FormControlLabel } from '@mui/material';
import { Business, ArrowForwardIos, ChevronRight } from '@mui/icons-material';
import { motion } from 'framer-motion';
import request from '../helper/api';
import MapComponent from './MapComponent';
import { CARD_SX, ROW_SX, LABEL_SX, FormCard, FormField, HoursRow, HOURS_FIELDS, inputSx } from './cards/AppCards';
import { NAVY, NAVY_GRADIENT, NAVY_CONTRAST, BRAND_GRADIENT, MUTED, BORDER, BG, SHADOW, TEXT_MUTED_LIGHT, PRIMARY_CONTRAST } from '../theme';

const TABS = [
  { key: 'hours',      label: 'Hours & Wi-Fi' },
  { key: 'theme',      label: 'Theme' },
  { key: 'ai',         label: 'Concierge AI' },
  { key: 'properties', label: 'Properties' },
];

const HotelRow = ({ data: hotel, navigate, accent }) => (
  <Box onClick={() => navigate(`/hotels/${hotel.id}`)}
    sx={{ ...ROW_SX, display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ width: 34, height: 34, borderRadius: 1.5, background: NAVY_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Typography sx={{ fontWeight: 900, fontSize: 14, color: NAVY_CONTRAST }}>{hotel.name?.[0]?.toUpperCase()}</Typography>
      </Box>
      <Box>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{hotel.name}</Typography>
        {hotel.address && <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.2 }}>{hotel.address}</Typography>}
      </Box>
    </Box>
    <ArrowForwardIos sx={{ fontSize: 11, color: accent }} />
  </Box>
);

function BrandDetails({ loading, setLoading, account, navigate, alertSuccess, alertError }) {
  const { id } = useParams();
  const [brand, setBrand] = useState(null);
  const [tab, setTab] = useState('hours');
  const [isDirty, setIsDirty] = useState(false);
  const [propagate, setPropagate] = useState(true);
  const [editValues, setEditValues] = useState({});

  const fetchBrand = async () => {
    const res = await request({ endpoint: `/hotels/brands/${id}`, method: 'GET', setLoading, setData: setBrand, defaultData: null, alertError });
    if (res?.data) loadValues(res.data);
  };

  const loadValues = (b) => setEditValues({
    checkInTime: b.checkInTime || '', checkOutTime: b.checkOutTime || '',
    breakfastHours: b.breakfastHours || '', lunchHours: b.lunchHours || '',
    dinnerHours: b.dinnerHours || '', snacksHours: b.snacksHours || '',
    poolHours: b.poolHours || '', gymHours: b.gymHours || '',
    restaurantHours: b.restaurantHours || '', roomServiceHours: b.roomServiceHours || '',
    houseKeepingHours: b.houseKeepingHours || '', wifiPassword: b.wifiPassword || '',
    llmInstructions: b.llmInstructions || '',
    primaryColor: b.themeConfig?.primaryColor || '',
    secondaryColor: b.themeConfig?.secondaryColor || '',
  });

  useEffect(() => { fetchBrand(); }, []);

  const handleInputChange = field => e => {
    setEditValues(prev => ({ ...prev, [field]: e.target.value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    const themeObj = {};
    if (editValues.primaryColor?.trim()) themeObj.primaryColor = editValues.primaryColor.trim();
    if (editValues.secondaryColor?.trim()) themeObj.secondaryColor = editValues.secondaryColor.trim();
    const { primaryColor, secondaryColor, ...rest } = editValues;
    const payload = { ...rest, themeConfig: Object.keys(themeObj).length ? themeObj : null, propagate };
    const res = await request({ endpoint: `/hotels/brands/${id}`, method: 'PATCH', data: payload, setLoading, alertSuccess, alertError });
    if (res?.success) { setBrand(res.data); loadValues(res.data); setIsDirty(false); }
  };

  if (!brand) return null;

  const primary = editValues.primaryColor || brand.themeConfig?.primaryColor;
  const secondary = editValues.secondaryColor || brand.themeConfig?.secondaryColor;
  const accent = primary || 'var(--app-primary)';
  const headerGradient = primary ? `linear-gradient(135deg, ${primary} 0%, ${secondary || primary} 100%)` : NAVY_GRADIENT;
  const hotelCount = brand.hotels?.length ?? 0;

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pb: 12, maxWidth: 1200, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        {/* Breadcrumb */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 2 }}>
          {[{ label: 'Brands', onClick: () => navigate('/brands') }, { label: brand.name }].map((item, i, arr) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography onClick={item.onClick} sx={{ fontSize: 12, fontWeight: 700, color: item.onClick ? MUTED : NAVY, cursor: item.onClick ? 'pointer' : 'default', '&:hover': item.onClick ? { color: NAVY } : {} }}>
                {item.label}
              </Typography>
              {i < arr.length - 1 && <ChevronRight sx={{ fontSize: 13, color: MUTED }} />}
            </Box>
          ))}
        </Box>

        {/* Hero */}
        <Box sx={{ borderRadius: 3, overflow: 'hidden', background: headerGradient, p: '20px 24px', position: 'relative', mb: 2.5 }}>
          <Typography sx={{ position: 'absolute', right: -20, top: -40, fontSize: 220, fontWeight: 900, color: 'rgba(255,255,255,0.07)', lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>
            {brand.name?.[0]}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 68, height: 68, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.18)', border: '2px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
              {brand.logoUrl
                ? <Box component="img" src={brand.logoUrl} alt={brand.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <Business sx={{ fontSize: 30, color: NAVY_CONTRAST }} />}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ ...LABEL_SX, fontSize: 9.5, color: TEXT_MUTED_LIGHT, mb: 0.5 }}>Brand</Typography>
              <Typography sx={{ fontSize: 24, fontWeight: 800, color: NAVY_CONTRAST, lineHeight: 1.2 }}>{brand.name}</Typography>
              <Typography sx={{ fontSize: 12, color: TEXT_MUTED_LIGHT, mt: 0.75 }}>{hotelCount} {hotelCount === 1 ? 'property' : 'properties'}</Typography>
            </Box>
          </Box>
        </Box>

        {/* Tabs */}
        <Box sx={{ display: 'flex', gap: 0.5, borderBottom: `1px solid ${BORDER}`, mb: 3, overflowX: 'auto', overflowY: 'hidden', pb: 0 }}>
          {TABS.map(({ key, label }) => (
            <Box key={key} component="button" onClick={() => setTab(key)}
              sx={{ px: 2, py: 1.5, border: 'none', bgcolor: 'transparent', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap', mb: '-1px',
                color: key === tab ? NAVY : MUTED, borderBottom: `2px solid ${key === tab ? 'var(--app-primary)' : 'transparent'}` }}>
              {label}
            </Box>
          ))}
        </Box>
      </motion.div>

      {/* Hours & Wi-Fi */}
      {tab === 'hours' && (
        <FormCard title="Operating hours" sub="Applies to all properties in this brand.">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            <MapComponent Component={HoursRow} data={HOURS_FIELDS} editValues={editValues} handleInputChange={handleInputChange} accent={accent} showNoDataAvailable={false} />
          </Box>
        </FormCard>
      )}

      {/* Theme */}
      {tab === 'theme' && (
        <FormCard title="Brand theme" sub="Colors cascade to all properties unless overridden per-hotel.">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <FormField label="Primary color">
              <TextField fullWidth size="small" value={editValues.primaryColor} onChange={handleInputChange('primaryColor')} placeholder="#D4AF37" sx={inputSx}
                InputProps={{ endAdornment: <input type="color" value={editValues.primaryColor || '#D4AF37'} onChange={e => handleInputChange('primaryColor')({ target: { value: e.target.value } })} style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} /> }} />
            </FormField>
            <FormField label="Secondary color">
              <TextField fullWidth size="small" value={editValues.secondaryColor} onChange={handleInputChange('secondaryColor')} placeholder="#C5A022" sx={inputSx}
                InputProps={{ endAdornment: <input type="color" value={editValues.secondaryColor || '#C5A022'} onChange={e => handleInputChange('secondaryColor')({ target: { value: e.target.value } })} style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} /> }} />
            </FormField>
          </Box>
        </FormCard>
      )}

      {/* Concierge AI */}
      {tab === 'ai' && (
        <FormCard title="Brand AI instructions" sub="Samantha uses these to answer guest questions across all properties.">
          <FormField label="Instructions">
            <TextField fullWidth multiline minRows={5} size="small" value={editValues.llmInstructions} onChange={handleInputChange('llmInstructions')}
              placeholder="e.g. All properties offer complimentary breakfast. Emphasize the loyalty program. Recommend the spa on weekends." sx={inputSx} />
          </FormField>
        </FormCard>
      )}

      {/* Properties */}
      {tab === 'properties' && (
        <Box sx={{ ...CARD_SX, overflow: 'hidden' }}>
          <Box sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${BORDER}` }}>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: NAVY }}>Properties</Typography>
            <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.25 }}>{hotelCount} {hotelCount === 1 ? 'hotel' : 'hotels'} in this brand</Typography>
          </Box>
          <MapComponent Component={HotelRow} data={brand.hotels || []} navigate={navigate} accent={accent} />
        </Box>
      )}

      {/* Unsaved changes pill */}
      {isDirty && (
        <Box sx={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: NAVY_GRADIENT, borderRadius: 99, px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1, boxShadow: '0 8px 32px rgba(0,0,0,0.35)', zIndex: 100, whiteSpace: 'nowrap' }}>
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'var(--app-primary)', flexShrink: 0 }} />
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: NAVY_CONTRAST, mr: 0.5 }}>Unsaved changes</Typography>
          <FormControlLabel sx={{ m: 0 }} control={<Checkbox checked={propagate} onChange={e => setPropagate(e.target.checked)} size="small" sx={{ color: NAVY_CONTRAST, '&.Mui-checked': { color: 'var(--app-primary)' } }} />}
            label={<Typography sx={{ fontSize: 11, color: TEXT_MUTED_LIGHT }}>All properties</Typography>} />
          <Box component="button" onClick={() => { loadValues(brand); setIsDirty(false); }}
            sx={{ border: '1px solid rgba(255,255,255,0.25)', bgcolor: 'transparent', color: NAVY_CONTRAST, px: 1.5, py: 0.6, borderRadius: 99, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
            Discard
          </Box>
          <Box component="button" onClick={handleSave}
            sx={{ border: 'none', background: BRAND_GRADIENT, color: PRIMARY_CONTRAST, px: 1.75, py: 0.6, borderRadius: 99, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
            Save
          </Box>
        </Box>
      )}
    </Box>
  );
}

export default BrandDetails;
