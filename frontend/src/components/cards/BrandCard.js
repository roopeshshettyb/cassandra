import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { ArrowForwardIos } from '@mui/icons-material';

import { NAVY, NAVY_GRADIENT, NAVY_CONTRAST, MUTED, BORDER, SHADOW, SHADOW_HOVER, TEXT_MUTED_LIGHT } from '../../theme';
import { CARD_SX, LABEL_SX, StatBox } from './AppCards';

const BrandCard = ({ data, navigate }) => {
  const brand = data;
  const primary = brand.themeConfig?.primaryColor;
  const secondary = brand.themeConfig?.secondaryColor;
  const headerGradient = primary
    ? `linear-gradient(135deg, ${primary} 0%, ${secondary || primary} 100%)`
    : NAVY_GRADIENT;
  const hotelCount = brand.hotels?.length ?? 0;

  return (
    <motion.div whileTap={{ scale: 0.98 }} whileHover={{ y: -3 }} transition={{ duration: 0.15 }} style={{ width: '100%' }}>
      <Box
        onClick={() => brand?.id && navigate?.(`/brands/${brand.id}`)}
        sx={{
          ...CARD_SX,
          border: `1px solid ${primary ? primary + '30' : BORDER}`,
          boxShadow: primary ? `0 2px 12px ${primary}25` : SHADOW,
          cursor: 'pointer',
          display: 'flex', flexDirection: 'column', height: '100%',
          '@media (hover: hover)': {
            '&:hover': { boxShadow: primary ? `0 8px 28px ${primary}40` : SHADOW_HOVER },
          },
        }}
      >
        {/* Gradient header */}
        <Box sx={{ background: headerGradient, px: 2.5, pt: 2, pb: 2.25, position: 'relative', overflow: 'hidden' }}>
          <Typography sx={{
            position: 'absolute', right: -4, bottom: -16,
            fontSize: 100, fontWeight: 900, lineHeight: 1,
            color: 'rgba(255,255,255,0.13)', userSelect: 'none', pointerEvents: 'none',
          }}>
            {brand.name?.[0]?.toUpperCase()}
          </Typography>

          <Typography sx={{ ...LABEL_SX, fontSize: 9.5, color: TEXT_MUTED_LIGHT, mb: 0.75 }}>Brand</Typography>

          <Typography sx={{
            fontWeight: 800, fontSize: 17, color: NAVY_CONTRAST, lineHeight: 1.3,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', pr: 8,
          }}>
            {brand.name}
          </Typography>

          <Typography sx={{ fontSize: 11, color: TEXT_MUTED_LIGHT, mt: 0.75 }}>
            {hotelCount} {hotelCount === 1 ? 'property' : 'properties'}
          </Typography>
        </Box>

        {/* Body */}
        <Box sx={{ px: 2.5, pt: 2, pb: 1.75, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, mb: 1.75 }}>
            <StatBox label="Check-in" value={brand.checkInTime || '—'} sub="Time" />
            <StatBox label="Check-out" value={brand.checkOutTime || '—'} sub="Time" />
          </Box>

          <Box sx={{ mt: 'auto', pt: 1.5, borderTop: `1px solid ${BORDER}` }}>
            <Box
              component="button"
              onClick={() => brand?.id && navigate?.(`/brands/${brand.id}`)}
              sx={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75,
                border: 'none', borderRadius: 2, py: 0.9,
                background: NAVY_GRADIENT, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: NAVY_CONTRAST,
                '&:hover': { opacity: 0.92 },
              }}
            >
              Open
              <ArrowForwardIos sx={{ fontSize: 10 }} />
            </Box>
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
};

export default BrandCard;
