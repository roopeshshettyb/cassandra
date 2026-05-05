import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Button, Checkbox, Container, FormControlLabel,
  Grid, TextField, Typography, Chip,
} from '@mui/material';
import { motion } from 'framer-motion';
import BusinessIcon from '@mui/icons-material/Business';
import EditIcon from '@mui/icons-material/Edit';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import request from '../helper/api';
import MapComponent from './MapComponent';
import { NAVY, MUTED, BRAND_GRADIENT, PRIMARY_CONTRAST, NAVY_GRADIENT, BORDER, SHADOW, SHADOW_HOVER } from '../theme';

const hoursFieldConfigs = [
  { key: 'checkInTime', label: 'Check-in Time', type: 'time' },
  { key: 'checkOutTime', label: 'Check-out Time', type: 'time' },
  { key: 'poolHours', label: 'Pool Hours' },
  { key: 'gymHours', label: 'Gym Hours' },
  { key: 'restaurantHours', label: 'Restaurant Hours' },
  { key: 'wifiPassword', label: 'Wi-Fi Password' },
  { key: 'breakfastHours', label: 'Breakfast Hours' },
  { key: 'lunchHours', label: 'Lunch Hours' },
  { key: 'dinnerHours', label: 'Dinner Hours' },
  { key: 'snacksHours', label: 'Snacks Hours' },
  { key: 'houseKeepingHours', label: 'House Keeping Hours' },
  { key: 'roomServiceHours', label: 'Room Service Hours' },
];

const HoursEditField = ({ data, editValues, handleInputChange }) => (
  <Grid item xs={12} sm={6}>
    <TextField fullWidth label={data.label} type={data.type || 'text'}
      value={editValues[data.key] || ''} onChange={handleInputChange(data.key)}
      inputProps={data.type === 'time' ? { step: 60 } : undefined} />
  </Grid>
);

function InfoRow({ data }) {
  if (!data?.value) return null;
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: `1px solid ${BORDER}` }}>
      <Typography sx={{ fontSize: 12, color: MUTED, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{data.label}</Typography>
      <Typography sx={{ fontSize: 13, color: NAVY, fontWeight: 700 }}>{data.value}</Typography>
    </Box>
  );
}

function HotelRow({ data, navigate, headerGradient, accent }) {
  return (
    <motion.div whileHover={{ x: 4 }} transition={{ duration: 0.15 }}>
      <Box
        onClick={() => navigate(`/hotels/${data.id}`)}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, borderRadius: 2, cursor: 'pointer', border: `1px solid ${BORDER}`, '&:hover': { borderColor: accent, boxShadow: `0 2px 8px ${accent}20` }, transition: 'all 0.15s' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 1.5, background: headerGradient, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Typography sx={{ fontWeight: 900, fontSize: 14, color: '#fff' }}>{data.name?.[0]?.toUpperCase()}</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{data.name}</Typography>
            {data.address && <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.2 }}>{data.address}</Typography>}
          </Box>
        </Box>
        <ArrowForwardIosIcon sx={{ fontSize: 11, color: accent }} />
      </Box>
    </motion.div>
  );
}

function BrandDetails({ loading, setLoading, account, navigate, alertSuccess, alertError }) {
  const { id } = useParams();
  const [brand, setBrand] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [propagate, setPropagate] = useState(true);
  const [editValues, setEditValues] = useState({
    checkInTime: '', checkOutTime: '', poolHours: '', gymHours: '',
    restaurantHours: '', wifiPassword: '', breakfastHours: '', lunchHours: '',
    dinnerHours: '', snacksHours: '', houseKeepingHours: '', roomServiceHours: '',
    llmInstructions: '', primaryColor: '', secondaryColor: '',
  });

  const loadEditValues = (b) => {
    setEditValues({
      checkInTime: b.checkInTime || '',
      checkOutTime: b.checkOutTime || '',
      poolHours: b.poolHours || '',
      gymHours: b.gymHours || '',
      restaurantHours: b.restaurantHours || '',
      wifiPassword: b.wifiPassword || '',
      breakfastHours: b.breakfastHours || '',
      lunchHours: b.lunchHours || '',
      dinnerHours: b.dinnerHours || '',
      snacksHours: b.snacksHours || '',
      houseKeepingHours: b.houseKeepingHours || '',
      roomServiceHours: b.roomServiceHours || '',
      llmInstructions: b.llmInstructions || '',
      primaryColor: b.themeConfig?.primaryColor || '',
      secondaryColor: b.themeConfig?.secondaryColor || '',
    });
  };

  const fetchBrand = async () => {
    const response = await request({ endpoint: `/hotels/brands/${id}`, method: 'GET', setLoading, defaultData: null, alertError });
    const brandData = response?.data;
    if (brandData) { setBrand(brandData); loadEditValues(brandData); }
  };

  useEffect(() => { fetchBrand(); }, []);

  const handleInputChange = (field) => (event) => setEditValues((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSave = async (event) => {
    event.preventDefault();
    const themeObj = {};
    if (editValues.primaryColor?.trim()) themeObj.primaryColor = editValues.primaryColor.trim();
    if (editValues.secondaryColor?.trim()) themeObj.secondaryColor = editValues.secondaryColor.trim();
    const payload = { ...editValues, themeConfig: Object.keys(themeObj).length ? themeObj : null, propagate };
    delete payload.primaryColor;
    delete payload.secondaryColor;

    const result = await request({ endpoint: `/hotels/brands/${id}`, method: 'PATCH', data: payload, setLoading, alertSuccess, alertError });
    if (result?.success) { setBrand(result.data); loadEditValues(result.data); setIsEditing(false); }
  };

  if (!brand) return null;

  const primary = brand.themeConfig?.primaryColor;
  const secondary = brand.themeConfig?.secondaryColor;
  const accent = primary || '#D4AF37';
  const headerGradient = primary ? `linear-gradient(135deg, ${primary} 0%, ${secondary || primary} 100%)` : NAVY_GRADIENT;
  const hotelCount = brand.hotels?.length ?? 0;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

        {/* Hero header */}
        <Box sx={{ borderRadius: 4, overflow: 'hidden', mb: 3, boxShadow: primary ? `0 8px 32px ${primary}35` : SHADOW }}>
          <Box sx={{ background: headerGradient, px: 3, pt: 3, pb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {/* Logo */}
              <Box sx={{ width: 64, height: 64, borderRadius: 2.5, overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.18)', border: '2px solid rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                {brand.logoUrl
                  ? <Box component="img" src={brand.logoUrl} alt={brand.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                  : null}
                <Box sx={{ display: brand.logoUrl ? 'none' : 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                  <BusinessIcon sx={{ fontSize: 30, color: 'rgba(255,255,255,0.85)' }} />
                </Box>
              </Box>
              {/* Name + stats */}
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 900, fontSize: 24, color: '#fff', lineHeight: 1.2 }}>{brand.name}</Typography>
                <Box sx={{ display: 'flex', gap: 1.5, mt: 1, flexWrap: 'wrap' }}>
                  <Chip label={`${hotelCount} ${hotelCount === 1 ? 'property' : 'properties'}`} size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 700, fontSize: 11 }} />
                  {primary && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: primary, border: '2px solid rgba(255,255,255,0.5)' }} />
                      {secondary && <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: secondary, border: '2px solid rgba(255,255,255,0.5)' }} />}
                    </Box>
                  )}
                </Box>
              </Box>
              {/* Edit button */}
              <Button
                startIcon={<EditIcon />}
                onClick={() => setIsEditing((p) => !p)}
                sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 2, px: 2, fontWeight: 700, bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
              >
                {isEditing ? 'Cancel' : 'Edit'}
              </Button>
            </Box>

            {/* Quick stats */}
            {(brand.checkInTime || brand.checkOutTime) && (
              <Box sx={{ display: 'flex', gap: 2, mt: 2.5 }}>
                {brand.checkInTime && (
                  <Box sx={{ px: 2, py: 1, bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AccessTimeIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }} />
                    <Box>
                      <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Check-in</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>{brand.checkInTime}</Typography>
                    </Box>
                  </Box>
                )}
                {brand.checkOutTime && (
                  <Box sx={{ px: 2, py: 1, bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AccessTimeIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }} />
                    <Box>
                      <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Check-out</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>{brand.checkOutTime}</Typography>
                    </Box>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </Box>

        {isEditing ? (
          /* ── Edit Form ──────────────────────────────────────── */
          <Box component="form" onSubmit={handleSave} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box sx={{ bgcolor: 'background.paper', borderRadius: 3, p: 3, border: `1px solid ${BORDER}`, boxShadow: SHADOW }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 2 }}>Operating Hours</Typography>
              <Grid container spacing={2}>
                <MapComponent Component={HoursEditField} data={hoursFieldConfigs} editValues={editValues} handleInputChange={handleInputChange} showNoDataAvailable={false} isLoading={loading} />
              </Grid>
            </Box>

            <Box sx={{ bgcolor: 'background.paper', borderRadius: 3, p: 3, border: `1px solid ${BORDER}`, boxShadow: SHADOW }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 2 }}>Theme Colors</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Primary color" value={editValues.primaryColor || ''} onChange={handleInputChange('primaryColor')} placeholder="#D4AF37"
                    InputProps={{ endAdornment: <input type="color" value={editValues.primaryColor || '#D4AF37'} onChange={(e) => handleInputChange('primaryColor')({ target: { value: e.target.value } })} style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} /> }}
                    InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Secondary color" value={editValues.secondaryColor || ''} onChange={handleInputChange('secondaryColor')} placeholder="#C5A022"
                    InputProps={{ endAdornment: <input type="color" value={editValues.secondaryColor || '#C5A022'} onChange={(e) => handleInputChange('secondaryColor')({ target: { value: e.target.value } })} style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} /> }}
                    InputLabelProps={{ shrink: true }} />
                </Grid>
              </Grid>
            </Box>

            <Box sx={{ bgcolor: 'background.paper', borderRadius: 3, p: 3, border: `1px solid ${BORDER}`, boxShadow: SHADOW }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 2 }}>LLM Instructions</Typography>
              <TextField fullWidth multiline minRows={4} label="Brand-level AI instructions"
                value={editValues.llmInstructions || ''} onChange={handleInputChange('llmInstructions')}
                placeholder="e.g. All properties offer complimentary breakfast. Emphasize loyalty program." />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <FormControlLabel
                control={<Checkbox checked={propagate} onChange={(e) => setPropagate(e.target.checked)} color="primary" />}
                label={<Typography sx={{ fontSize: 13, color: MUTED }}>Apply to all {brand.name} properties ({hotelCount} hotels)</Typography>}
              />
              <Button type="submit" variant="contained" disabled={loading}
                sx={{ background: BRAND_GRADIENT, color: PRIMARY_CONTRAST, px: 3, fontWeight: 700, borderRadius: 2 }}>
                Save Changes
              </Button>
            </Box>
          </Box>
        ) : (
          /* ── View Mode ──────────────────────────────────────── */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Hours card */}
            {hoursFieldConfigs.some(({ key }) => brand[key]) && (
              <Box sx={{ bgcolor: 'background.paper', borderRadius: 3, p: 3, border: `1px solid ${BORDER}`, boxShadow: SHADOW }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <AccessTimeIcon sx={{ fontSize: 15, color: 'primary.main' }} />
                  <Typography sx={{ fontWeight: 800, fontSize: 12, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Operating Hours</Typography>
                </Box>
                <MapComponent Component={InfoRow} data={hoursFieldConfigs.filter(({ key }) => brand[key]).map(({ key, label }) => ({ key, label, value: brand[key] }))} showNoDataAvailable={false} />
              </Box>
            )}

            {/* LLM card */}
            {brand.llmInstructions && (
              <Box sx={{ bgcolor: 'background.paper', borderRadius: 3, p: 3, border: `1px solid ${BORDER}`, boxShadow: SHADOW }}>
                <Typography sx={{ fontWeight: 800, fontSize: 12, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.5 }}>LLM Instructions</Typography>
                <Typography sx={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>{brand.llmInstructions}</Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Properties */}
        {hotelCount > 0 && (
          <Box sx={{ mt: 3, bgcolor: 'background.paper', borderRadius: 3, p: 3, border: `1px solid ${BORDER}`, boxShadow: SHADOW }}>
            <Typography sx={{ fontWeight: 800, fontSize: 12, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 2 }}>
              Properties ({hotelCount})
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <MapComponent Component={HotelRow} data={brand.hotels} showNoDataAvailable={false} navigate={navigate} headerGradient={headerGradient} accent={accent} />
            </Box>
          </Box>
        )}
      </motion.div>
    </Container>
  );
}

export default BrandDetails;
