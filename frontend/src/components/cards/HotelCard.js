import { Avatar, Box, Chip, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

import { NAVY, NAVY_GRADIENT, MUTED, BORDER, SHADOW, SHADOW_HOVER, TEXT_MUTED_LIGHT, NAVY_CONTRAST, STATUS_ERROR_BG, STATUS_ERROR, STATUS_WARNING_BG, STATUS_WARNING } from '../../theme';
import { CARD_SX, ROW_SX, LABEL_SX, StatBox } from './AppCards';

const openCount = (hotel) => parseInt(hotel.openRequestsCount || 0, 10);
const activeCount = (hotel) => parseInt(hotel.activeGuestsCount || 0, 10);

const HotelCard = ({ data, navigate }) => {
  const hotel = data;
  const primary = hotel.themeConfig?.primaryColor;
  const secondary = hotel.themeConfig?.secondaryColor;
  const accent = primary || 'var(--app-primary)';
  const headerGradient = primary
    ? `linear-gradient(135deg, ${primary} 0%, ${secondary || primary} 100%)`
    : NAVY_GRADIENT;

  return (
    <motion.div whileTap={{ scale: 0.98 }} whileHover={{ y: -3 }} transition={{ duration: 0.15 }} style={{ width: '100%' }}>
      <Box sx={{
        ...CARD_SX,
        border: `1px solid ${primary ? primary + '30' : BORDER}`,
        boxShadow: primary ? `0 2px 12px ${primary}25` : SHADOW,
        display: 'flex', flexDirection: 'column', height: '100%',
        '@media (hover: hover)': {
          '&:hover': { boxShadow: primary ? `0 8px 28px ${primary}40` : SHADOW_HOVER },
        },
      }}>
        {/* Gradient header */}
        <Box sx={{ background: headerGradient, px: 2.5, pt: 2, pb: 2.25, position: 'relative', overflow: 'hidden' }}>
          {/* Watermark letter */}
          <Typography sx={{
            position: 'absolute', right: -4, bottom: -16,
            fontSize: 100, fontWeight: 900, lineHeight: 1,
            color: 'rgba(255,255,255,0.13)', userSelect: 'none', pointerEvents: 'none',
          }}>
            {hotel.name?.[0]?.toUpperCase()}
          </Typography>

          <Typography sx={{ ...LABEL_SX, fontSize: 9.5, color: TEXT_MUTED_LIGHT, mb: 0.75 }}>
            {hotel.brand?.name || ' '}
          </Typography>

          <Typography sx={{
            fontWeight: 800, fontSize: 17, color: NAVY_CONTRAST, lineHeight: 1.3,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            pr: 8,
          }}>
            {hotel.name}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75 }}>
            <LocationOnIcon sx={{ fontSize: 11, color: TEXT_MUTED_LIGHT, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 11, color: TEXT_MUTED_LIGHT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {hotel.address || 'No address'}
            </Typography>
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{ px: 2.5, pt: 2, pb: 1.75, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mb: 1.75 }}>
            <StatBox label="Check-in" value={hotel.checkInTime || '—'} sub="Time" />
            <StatBox label="Open Req." value={openCount(hotel)} sub="Now" />
            <StatBox label="Active" value={activeCount(hotel)} sub="Guests" />
          </Box>

          <Box sx={{ mt: 'auto', pt: 1.5, borderTop: `1px solid ${BORDER}` }}>
            <Box
              component="button"
              onClick={() => hotel?.id && navigate?.(`/hotels/${hotel.id}`)}
              sx={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75,
                border: 'none', borderRadius: 2, py: 0.9,
                background: NAVY_GRADIENT, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: NAVY_CONTRAST,
                '&:hover': { opacity: 0.92 },
              }}
            >
              Open
              <ArrowForwardIosIcon sx={{ fontSize: 10 }} />
            </Box>
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
};

export default HotelCard;

/** Compact table row for ManageHotels table view. MapComponent-compatible. */
export function HotelTableRow({ data: hotel, navigate }) {
  const accent = hotel.themeConfig?.primaryColor || 'var(--app-primary)';
  const open = openCount(hotel);
  return (
    <Box
      onClick={() => navigate?.(`/hotels/${hotel.id}`)}
      sx={{ ...ROW_SX, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', px: 2.5, py: 1.75, alignItems: 'center', gap: 1 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
        <Avatar src={hotel.logoUrl || undefined} sx={{ width: 36, height: 36, fontSize: 14, fontWeight: 700, bgcolor: accent, flexShrink: 0 }}>
          {!hotel.logoUrl && hotel.name?.[0]?.toUpperCase()}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hotel.name}</Typography>
          <Typography sx={{ fontSize: 11, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hotel.address || '—'}</Typography>
        </Box>
        {open > 0 && <Chip label={`${open} open`} size="small" sx={{ fontSize: 10, height: 18, fontWeight: 700, bgcolor: STATUS_ERROR_BG, color: STATUS_ERROR, border: 'none', flexShrink: 0 }} />}
      </Box>
      <Typography sx={{ fontSize: 13, color: MUTED }}>{hotel.brand?.name || '—'}</Typography>
      <Typography sx={{ fontSize: 13, color: NAVY, fontWeight: 600 }}>{hotel.checkInTime || '—'} / {hotel.checkOutTime || '—'}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: accent }}>Manage</Typography>
        <ArrowForwardIosIcon sx={{ fontSize: 9, color: accent }} />
      </Box>
    </Box>
  );
}

/** Property pulse row for dashboard — avatar, name, active/arrivals/open columns. MapComponent-compatible. */
export function PropertyRow({ data: row, navigate }) {
  return (
    <Box onClick={() => navigate?.(`/hotels/${row.id}`)} sx={{ ...ROW_SX, display: 'grid', gridTemplateColumns: { xs: '1fr auto', md: '2fr 1fr 1fr 1fr' }, px: 2.5, py: { xs: 1.25, md: 1.75 }, alignItems: 'center', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
        <Avatar src={row.logoUrl || undefined} sx={{ width: 28, height: 28, fontSize: 12, fontWeight: 700, bgcolor: NAVY, flexShrink: 0 }}>
          {!row.logoUrl && row.name?.[0]?.toUpperCase()}
        </Avatar>
        <Typography sx={{ fontSize: { xs: 13, md: 13.5 }, fontWeight: 700, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</Typography>
      </Box>
      <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
        {row.open > 0 && <Chip label={`${row.open} open req.`} size="small" sx={{ fontSize: 10, height: 18, fontWeight: 700, bgcolor: STATUS_ERROR_BG, color: STATUS_ERROR, border: 'none' }} />}
      </Box>
      <Typography sx={{ display: { xs: 'none', md: 'block' }, fontSize: 14, fontWeight: 700, color: NAVY }}>{row.active}</Typography>
      <Typography sx={{ display: { xs: 'none', md: 'block' }, fontSize: 14, fontWeight: 700, color: NAVY }}>{row.arrivals}</Typography>
      <Box sx={{ display: { xs: 'none', md: 'flex' } }}>
        {row.open > 0
          ? <Chip label={row.open} size="small" sx={{ fontSize: 10, height: 20, fontWeight: 700, bgcolor: row.open > 5 ? STATUS_ERROR_BG : STATUS_WARNING_BG, color: row.open > 5 ? STATUS_ERROR : STATUS_WARNING, border: 'none' }} />
          : <Typography sx={{ fontSize: 13, color: MUTED }}>0</Typography>}
      </Box>
    </Box>
  );
}
