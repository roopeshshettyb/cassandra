import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Checkbox, FormControlLabel } from '@mui/material';
import { Business } from '@mui/icons-material';
import { motion } from 'framer-motion';
import request from '../helper/api';
import MapComponent from './MapComponent';
import { CARD_SX, ROW_SX, FormCard } from './cards/AppCards';
import { DetailBreadcrumb, DetailHero, DetailTabBar, UnsavedChangesBar, HoursTab, AiTab, BasicThemePicker, buildThemePayload } from './DetailShell';
import { NAVY, NAVY_GRADIENT, NAVY_CONTRAST, MUTED, BORDER, TEXT_MUTED_LIGHT } from '../theme';

const BRAND_THEME_KEYS = ['primaryColor', 'secondaryColor'];

const TABS = [
  { key: 'hours',      label: 'Hours & Wi-Fi' },
  { key: 'theme',      label: 'Theme' },
  { key: 'ai',         label: 'Concierge AI' },
  { key: 'properties', label: 'Properties' },
];

const HotelRow = ({ data: hotel, navigate }) => (
  <Box onClick={() => navigate(`/hotels/${hotel.id}`)}
    sx={{ ...ROW_SX, display: 'flex', alignItems: 'center', px: 2, py: 1.5, gap: 1.5 }}>
    <Box sx={{ width: 34, height: 34, borderRadius: 1.5, background: NAVY_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Typography sx={{ fontWeight: 900, fontSize: 14, color: NAVY_CONTRAST }}>{hotel.name?.[0]?.toUpperCase()}</Typography>
    </Box>
    <Box>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{hotel.name}</Typography>
      {hotel.address && <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.2 }}>{hotel.address}</Typography>}
    </Box>
  </Box>
);

function BrandDetails({ loading, setLoading, account, navigate, alertSuccess, alertError }) {
  const { id } = useParams();
  const [brand, setBrand] = useState(null);
  const [tab, setTab] = useState('hours');
  const [isDirty, setIsDirty] = useState(false);
  const [propagate, setPropagate] = useState(true);
  const [editValues, setEditValues] = useState({});

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

  const fetchBrand = async () => {
    const res = await request({ endpoint: `/hotels/brands/${id}`, method: 'GET', setLoading, setData: setBrand, defaultData: null, alertError });
    if (res?.data) loadValues(res.data);
  };

  useEffect(() => { fetchBrand(); }, []);

  const handleInputChange = field => e => {
    setEditValues(prev => ({ ...prev, [field]: e.target.value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    const { themeConfig, payload } = buildThemePayload(editValues, BRAND_THEME_KEYS);
    const res = await request({
      endpoint: `/hotels/brands/${id}`, method: 'PATCH',
      data: { ...payload, themeConfig, propagate },
      setLoading, alertSuccess, alertError,
    });
    if (res?.success) { setBrand(res.data); loadValues(res.data); setIsDirty(false); }
  };

  if (!brand) return null;

  const primary = editValues.primaryColor || brand.themeConfig?.primaryColor;
  const secondary = editValues.secondaryColor || brand.themeConfig?.secondaryColor;
  const headerGradient = primary ? `linear-gradient(135deg, ${primary} 0%, ${secondary || primary} 100%)` : NAVY_GRADIENT;
  const hotelCount = brand.hotels?.length ?? 0;

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pb: 12, maxWidth: 1200, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <DetailBreadcrumb items={[
          { label: 'Brands', onClick: () => navigate('/brands') },
          { label: brand.name },
        ]} />

        <DetailHero
          name={brand.name}
          gradient={headerGradient}
          eyebrow="Brand"
          logoUrl={brand.logoUrl}
          fallback={<Business sx={{ fontSize: 30, color: NAVY_CONTRAST }} />}
          meta={<Typography sx={{ fontSize: 12, color: TEXT_MUTED_LIGHT }}>{hotelCount} {hotelCount === 1 ? 'property' : 'properties'}</Typography>}
        />

        <DetailTabBar tabs={TABS} active={tab} onChange={setTab} />
      </motion.div>

      {tab === 'hours' && (
        <HoursTab editValues={editValues} handleInputChange={handleInputChange}
          accent={primary || 'var(--app-primary)'}
          sub="Applies to all properties in this brand." />
      )}

      {tab === 'theme' && (
        <FormCard title="Brand theme" sub="Colors cascade to all properties unless overridden per-hotel.">
          <BasicThemePicker editValues={editValues} handleInputChange={handleInputChange} />
        </FormCard>
      )}

      {tab === 'ai' && (
        <AiTab editValues={editValues} handleInputChange={handleInputChange}
          title="Brand AI instructions"
          sub="Samantha uses these to answer guest questions across all properties."
          placeholder="Ex. All properties offer complimentary breakfast. Recommend the spa on weekends." />
      )}

      {tab === 'properties' && (
        <Box sx={{ ...CARD_SX, overflow: 'hidden' }}>
          <Box sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${BORDER}` }}>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: NAVY }}>Properties</Typography>
            <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.25 }}>{hotelCount} {hotelCount === 1 ? 'hotel' : 'hotels'} in this brand</Typography>
          </Box>
          <MapComponent Component={HotelRow} data={brand.hotels || []} navigate={navigate} />
        </Box>
      )}

      {isDirty && (
        <UnsavedChangesBar onDiscard={() => { loadValues(brand); setIsDirty(false); }} onSave={handleSave}
          extra={
            <FormControlLabel sx={{ m: 0 }}
              control={<Checkbox checked={propagate} onChange={e => setPropagate(e.target.checked)} size="small" sx={{ color: NAVY_CONTRAST, '&.Mui-checked': { color: 'var(--app-primary)' } }} />}
              label={<Typography sx={{ fontSize: 11, color: TEXT_MUTED_LIGHT }}>All properties</Typography>} />
          } />
      )}
    </Box>
  );
}

export default BrandDetails;
