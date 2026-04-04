import React from 'react';
import { Avatar, Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

import { BRAND_GRADIENT, NAVY_GRADIENT, NAVY, MUTED, BORDER, SHADOW, SHADOW_HOVER, TEXT_MUTED_DARK, NAVY_CONTRAST } from '../../theme';

const HotelCard = ({ data, navigate }) => {
  const hotel = data;

  return (
    <motion.div whileTap={{ scale: 0.98 }} whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
      <Box
        onClick={() => hotel?.id && navigate?.(`/hotels/${hotel.id}`)}
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 3,
          overflow: 'hidden',
          border: `1px solid ${BORDER}`,
          boxShadow: SHADOW,
          cursor: 'pointer',
          '@media (hover: hover)': { '&:hover': { boxShadow: SHADOW_HOVER } },
        }}
      >
        {/* Navy banner with centered icon */}
        <Box sx={{ background: NAVY_GRADIENT, height: 90, display: 'flex', alignItems: 'center', px: 2.5, gap: 2 }}>
          <Avatar
            src={hotel.logoUrl || undefined}
            sx={{ width: 44, height: 44, borderRadius: 2, background: BRAND_GRADIENT, fontSize: 18, fontWeight: 700, color: NAVY_CONTRAST, flexShrink: 0 }}
          >
            {!hotel.logoUrl && hotel.name?.[0]?.toUpperCase()}
          </Avatar>
          <Typography sx={{ fontWeight: 700, fontSize: 15, color: NAVY_CONTRAST, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {hotel.name}
          </Typography>
        </Box>

        {/* Info rows */}
        <Box sx={{ px: 2.5, py: 2, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {hotel.address ? (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <LocationOnIcon sx={{ fontSize: 14, color: MUTED, mt: 0.2, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 12, color: MUTED, lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {hotel.address}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocationOnIcon sx={{ fontSize: 14, color: TEXT_MUTED_DARK, flexShrink: 0, opacity: 0.5 }} />
              <Typography sx={{ fontSize: 12, color: TEXT_MUTED_DARK, fontStyle: 'italic', opacity: 0.6 }}>No address</Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccessTimeIcon sx={{ fontSize: 14, color: MUTED, flexShrink: 0 }} />
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Box>
                <Typography sx={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>In</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{hotel.checkInTime || '—'}</Typography>
              </Box>
              <Box sx={{ width: 1, bgcolor: BORDER, mx: 0.5 }} />
              <Box>
                <Typography sx={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Out</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{hotel.checkOutTime || '—'}</Typography>
              </Box>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 0.5, mt: 0.25, borderTop: `1px solid ${BORDER}` }}>
            <Typography sx={{ fontSize: 10, color: TEXT_MUTED_DARK, fontFamily: 'monospace', opacity: 0.6 }}>#{hotel.id}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'primary.main' }}>Manage</Typography>
              <ArrowForwardIosIcon sx={{ fontSize: 10, color: 'primary.main' }} />
            </Box>
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
};

export default HotelCard;
