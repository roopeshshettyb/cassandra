import React from 'react';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import HotelIcon from '@mui/icons-material/Hotel';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

import { GOLD_GRADIENT, NAVY_GRADIENT, NAVY, MUTED } from '../../theme';

const HotelCard = ({ data, navigate }) => {
  const hotel = data;

  return (
    <motion.div whileTap={{ scale: 0.98 }} whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
      <Box
        onClick={() => hotel?.id && navigate?.(`/hotels/${hotel.id}`)}
        sx={{
          bgcolor: '#fff',
          borderRadius: 3,
          overflow: 'hidden',
          border: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          cursor: 'pointer',
          '&:hover': { boxShadow: '0 6px 20px rgba(0,0,0,0.1)' },
        }}
      >
        {/* Navy banner with centered icon */}
        <Box sx={{ background: NAVY_GRADIENT, height: 90, display: 'flex', alignItems: 'center', px: 2.5, gap: 2 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: 2, background: GOLD_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <HotelIcon sx={{ fontSize: 22, color: '#fff' }} />
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#fff', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
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
              <LocationOnIcon sx={{ fontSize: 14, color: 'rgba(136,136,136,0.3)', flexShrink: 0 }} />
              <Typography sx={{ fontSize: 12, color: 'rgba(136,136,136,0.4)', fontStyle: 'italic' }}>No address</Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccessTimeIcon sx={{ fontSize: 14, color: MUTED, flexShrink: 0 }} />
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Box>
                <Typography sx={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>In</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{hotel.checkInTime || '—'}</Typography>
              </Box>
              <Box sx={{ width: 1, bgcolor: 'rgba(0,0,0,0.08)', mx: 0.5 }} />
              <Box>
                <Typography sx={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Out</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{hotel.checkOutTime || '—'}</Typography>
              </Box>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 0.5, mt: 0.25, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
            <Typography sx={{ fontSize: 10, color: 'rgba(136,136,136,0.4)', fontFamily: 'monospace' }}>#{hotel.id}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#C5A022' }}>Manage</Typography>
              <ArrowForwardIosIcon sx={{ fontSize: 10, color: '#C5A022' }} />
            </Box>
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
};

export default HotelCard;
