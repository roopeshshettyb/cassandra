import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import BusinessIcon from '@mui/icons-material/Business';

import { NAVY_GRADIENT, MUTED, BORDER, SHADOW, SHADOW_HOVER, TEXT_MUTED_DARK } from '../../theme';

const BrandCard = ({ data, navigate }) => {
  const brand = data;
  const primary = brand.themeConfig?.primaryColor;
  const secondary = brand.themeConfig?.secondaryColor;
  const accent = primary || '#D4AF37';
  const headerGradient = primary
    ? `linear-gradient(135deg, ${primary} 0%, ${secondary || primary} 100%)`
    : NAVY_GRADIENT;

  const hotelCount = brand.hotels?.length ?? 0;

  return (
    <motion.div whileTap={{ scale: 0.98 }} whileHover={{ y: -3 }} transition={{ duration: 0.15 }}>
      <Box
        onClick={() => brand?.id && navigate?.(`/brands/${brand.id}`)}
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
        <Box sx={{ background: headerGradient, px: 2.5, pt: 2.5, pb: 2.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
            <Box sx={{
              width: 52, height: 52, borderRadius: 2, flexShrink: 0,
              overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.18)',
              border: '2px solid rgba(255,255,255,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
            }}>
              {brand.logoUrl
                ? <Box component="img" src={brand.logoUrl} alt={brand.name}
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : null}
              <Box sx={{ display: brand.logoUrl ? 'none' : 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                <BusinessIcon sx={{ fontSize: 24, color: 'rgba(255,255,255,0.8)' }} />
              </Box>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#fff', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {brand.name}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', mt: 0.4 }}>
                {hotelCount} {hotelCount === 1 ? 'property' : 'properties'}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{ px: 2.5, pt: 1.75, pb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1.75 }}>
            {[{ label: 'Check in', value: brand.checkInTime }, { label: 'Check out', value: brand.checkOutTime }].map(({ label, value }) => (
              <Box key={label} sx={{ flex: 1, borderRadius: 2, p: 1.1, textAlign: 'center', bgcolor: `${accent}12`, border: `1px solid ${accent}28` }}>
                <Typography sx={{ fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{label}</Typography>
                <Typography sx={{ fontSize: 15, fontWeight: 800, color: accent, lineHeight: 1.2, mt: 0.3 }}>{value || '—'}</Typography>
              </Box>
            ))}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 1, borderTop: `1px solid ${BORDER}` }}>
            <Typography sx={{ fontSize: 10, color: TEXT_MUTED_DARK, fontFamily: 'monospace', opacity: 0.5 }}>#{brand.id}</Typography>
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

export default BrandCard;
