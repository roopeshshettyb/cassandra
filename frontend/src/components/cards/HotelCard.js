import { Avatar, Box, Chip, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

import { NAVY, NAVY_GRADIENT, MUTED, BORDER, SHADOW, SHADOW_HOVER, TEXT_MUTED_DARK, STATUS_ERROR_BG, STATUS_ERROR, STATUS_WARNING_BG, STATUS_WARNING } from '../../theme';

const HotelCard = ({ data, navigate }) => {
  const hotel = data;
  const primary = hotel.themeConfig?.primaryColor;
  const secondary = hotel.themeConfig?.secondaryColor;
  const accent = primary || '#D4AF37';
  const headerGradient = primary
    ? `linear-gradient(135deg, ${primary} 0%, ${secondary || primary} 100%)`
    : NAVY_GRADIENT;

  return (
    <motion.div whileTap={{ scale: 0.98 }} whileHover={{ y: -3 }} transition={{ duration: 0.15 }}>
      <Box
        onClick={() => hotel?.id && navigate?.(`/hotels/${hotel.id}`)}
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 3,
          overflow: 'hidden',
          border: `1px solid ${primary ? primary + '30' : BORDER}`,
          boxShadow: primary ? `0 2px 12px ${primary}25` : SHADOW,
          cursor: 'pointer',
          '@media (hover: hover)': {
            '&:hover': { boxShadow: primary ? `0 8px 28px ${primary}40` : SHADOW_HOVER },
          },
        }}
      >
        {/* Themed header */}
        <Box sx={{ background: headerGradient, px: 2.5, pt: 2.5, pb: 2.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
            {/* Logo tile */}
            <Box sx={{
              width: 52, height: 52, borderRadius: 2, flexShrink: 0,
              overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.18)',
              border: '2px solid rgba(255,255,255,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
            }}>
              {hotel.logoUrl
                ? <Box component="img" src={hotel.logoUrl} alt={hotel.name}
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : null}
              <Box sx={{ display: hotel.logoUrl ? 'none' : 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ fontWeight: 900, fontSize: 22, color: '#fff', lineHeight: 1 }}>
                  {hotel.name?.[0]?.toUpperCase()}
                </Typography>
              </Box>
            </Box>
            {/* Name + rating */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{
                fontWeight: 800, fontSize: 15, color: '#fff', lineHeight: 1.35,
                overflow: 'hidden', textOverflow: 'ellipsis',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}>
                {hotel.name}
              </Typography>
              {hotel.rating && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mt: 0.5 }}>
                  <StarRoundedIcon sx={{ fontSize: 13, color: '#FFD700' }} />
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
                    {hotel.rating.toFixed(1)}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{ px: 2.5, pt: 1.75, pb: 2 }}>
          {/* Address */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mb: 1.75 }}>
            <LocationOnIcon sx={{ fontSize: 13, color: MUTED, mt: 0.25, flexShrink: 0 }} />
            {hotel.address
              ? <Typography sx={{ fontSize: 12, color: MUTED, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {hotel.address}
                </Typography>
              : <Typography sx={{ fontSize: 12, color: TEXT_MUTED_DARK, fontStyle: 'italic', opacity: 0.55 }}>No address</Typography>
            }
          </Box>

          {/* Check-in / Check-out badges */}
          <Box sx={{ display: 'flex', gap: 1, mb: 1.75 }}>
            {[{ label: 'Check in', value: hotel.checkInTime }, { label: 'Check out', value: hotel.checkOutTime }].map(({ label, value }) => (
              <Box key={label} sx={{
                flex: 1, borderRadius: 2, p: 1.1, textAlign: 'center',
                bgcolor: `${accent}12`, border: `1px solid ${accent}28`,
              }}>
                <Typography sx={{ fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{label}</Typography>
                <Typography sx={{ fontSize: 15, fontWeight: 800, color: accent, lineHeight: 1.2, mt: 0.3 }}>{value || '—'}</Typography>
              </Box>
            ))}
          </Box>

          {/* Footer */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 1, borderTop: `1px solid ${BORDER}` }}>
            <Typography sx={{ fontSize: 10, color: TEXT_MUTED_DARK, fontFamily: 'monospace', opacity: 0.5 }}>#{hotel.id}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: accent }}>Manage</Typography>
              <ArrowForwardIosIcon sx={{ fontSize: 9, color: accent }} />
            </Box>
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
};

export default HotelCard;

/** Property pulse row for dashboard — avatar, name, active/arrivals/open columns. MapComponent-compatible. */
export function PropertyRow({ data: row }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr auto', md: '2fr 1fr 1fr 1fr' }, px: 2.5, py: { xs: 1.25, md: 1.75 }, alignItems: 'center', borderBottom: `1px solid ${BORDER}`, gap: 1, '&:last-child': { borderBottom: 'none' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
        <Avatar src={row.logoUrl || undefined} sx={{ width: 28, height: 28, fontSize: 12, fontWeight: 700, bgcolor: NAVY, flexShrink: 0 }}>
          {!row.logoUrl && row.name?.[0]?.toUpperCase()}
        </Avatar>
        <Typography sx={{ fontSize: { xs: 13, md: 13.5 }, fontWeight: 700, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</Typography>
      </Box>
      {/* Mobile badge */}
      <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
        {row.open > 0 && <Chip label={`${row.open} open req.`} size="small" sx={{ fontSize: 10, height: 18, fontWeight: 700, bgcolor: STATUS_ERROR_BG, color: STATUS_ERROR, border: 'none' }} />}
      </Box>
      {/* Desktop columns */}
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
