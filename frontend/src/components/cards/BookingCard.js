import React from 'react';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import HotelIcon from '@mui/icons-material/Hotel';
import PersonIcon from '@mui/icons-material/Person';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import NightsStayIcon from '@mui/icons-material/NightsStay';

import { GOLD_GRADIENT, NAVY, MUTED } from '../../theme';

const statusConfig = {
  Active:    { color: '#059669', bg: 'rgba(5,150,105,0.1)' },
  Upcoming:  { color: '#2563EB', bg: 'rgba(37,99,235,0.1)' },
  Past:      { color: '#888888', bg: 'rgba(136,136,136,0.1)' },
  Cancelled: { color: '#DC2626', bg: 'rgba(220,38,38,0.1)' },
};

const BookingCard = ({ data, navigate }) => {
  const booking = data;
  const hotelName = booking.hotel?.name || 'Unknown Hotel';
  const start = booking.startTime ? new Date(booking.startTime) : null;
  const end = booking.endTime ? new Date(booking.endTime) : null;
  const fmtDate = (d) => d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const nights = start && end ? Math.round((end - start) / 86400000) : 0;
  const now = new Date();
  const isActive = start && end && now >= start && now <= end;
  const isPast = end && now > end;
  const status = booking.status && statusConfig[booking.status]
    ? booking.status
    : isActive ? 'Active' : isPast ? 'Past' : 'Upcoming';
  const st = statusConfig[status];
  const guestName = booking.guest?.name || booking.guest?.email || null;

  return (
    <motion.div whileTap={{ scale: 0.98 }} whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
      <Box
        onClick={() => booking?.id && navigate?.(`/bookings/${booking.id}`)}
        sx={{
          bgcolor: '#fff',
          borderRadius: 3,
          border: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          cursor: 'pointer',
          position: 'relative',
          '&:hover': { boxShadow: '0 6px 20px rgba(0,0,0,0.1)' },
        }}
      >
        {/* Gold left accent */}
        <Box sx={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: GOLD_GRADIENT, borderRadius: '3px 0 0 3px' }} />

        {/* Status badge — absolute top-right, never pushes layout */}
        <Box sx={{ position: 'absolute', top: 14, right: 14, px: 1.5, py: 0.4, borderRadius: 99, bgcolor: st.bg }}>
          <Typography sx={{ fontSize: 10, fontWeight: 700, color: st.color, whiteSpace: 'nowrap' }}>{status}</Typography>
        </Box>

        {/* Content — right padding reserves space for the badge */}
        <Box sx={{ pl: 1.5, pr: 9, pt: 2.5, pb: 2.5 }}>

          {/* Hotel header */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, mb: 1.75 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, background: GOLD_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <HotelIcon sx={{ fontSize: 18, color: '#fff' }} />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1, pt: 0.2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14, color: NAVY, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {hotelName}
              </Typography>
              {booking.hotel?.address && (
                <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {booking.hotel.address}
                </Typography>
              )}
            </Box>
          </Box>

          {/* Divider */}
          <Box sx={{ height: 1, bgcolor: 'rgba(0,0,0,0.05)', mx: -0.5, mb: 1.5 }} />

          {/* Dates */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
            <CalendarTodayIcon sx={{ fontSize: 13, color: MUTED, mt: 0.3, flexShrink: 0 }} />
            <Box>
              <Typography sx={{ fontSize: 12, color: NAVY, fontWeight: 600, lineHeight: 1.4 }}>
                {fmtDate(start)}
              </Typography>
              <Typography sx={{ fontSize: 12, color: NAVY, fontWeight: 600, lineHeight: 1.4 }}>
                {fmtDate(end)}
              </Typography>
            </Box>
            {nights > 0 && (
              <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <NightsStayIcon sx={{ fontSize: 12, color: MUTED }} />
                <Typography sx={{ fontSize: 11, color: MUTED, whiteSpace: 'nowrap' }}>
                  {nights}n
                </Typography>
              </Box>
            )}
          </Box>

          {/* Guest */}
          {guestName && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon sx={{ fontSize: 13, color: MUTED, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 12, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {guestName}
              </Typography>
            </Box>
          )}

          {/* Footer */}
          <Box sx={{ mt: 1.5, pt: 1.25, borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 10, color: 'rgba(136,136,136,0.5)', fontFamily: 'monospace' }}>
              #{booking.id}
            </Typography>
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
};

export default BookingCard;
