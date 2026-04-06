import { Avatar, Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import PersonIcon from '@mui/icons-material/Person';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import NightsStayIcon from '@mui/icons-material/NightsStay';

import { BRAND_GRADIENT, NAVY, MUTED, BORDER, SHADOW, SHADOW_HOVER, STATUS_SUCCESS, STATUS_SUCCESS_BG, STATUS_INFO, STATUS_INFO_BG, STATUS_ERROR, STATUS_ERROR_BG, TEXT_MUTED_DARK } from '../../theme';

const statusConfig = {
  Active:    { color: STATUS_SUCCESS, bg: STATUS_SUCCESS_BG },
  Upcoming:  { color: STATUS_INFO,    bg: STATUS_INFO_BG },
  Past:      { color: MUTED,          bg: TEXT_MUTED_DARK }, 
  Cancelled: { color: STATUS_ERROR,   bg: STATUS_ERROR_BG },
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
          bgcolor: 'background.paper',
          borderRadius: 3,
          border: `1px solid ${BORDER}`,
          boxShadow: SHADOW,
          cursor: 'pointer',
          position: 'relative',
          '@media (hover: hover)': { '&:hover': { boxShadow: SHADOW_HOVER } },
        }}
      >
        {/* Gold left accent */}
        <Box sx={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: BRAND_GRADIENT, borderRadius: '3px 0 0 3px' }} />

        {/* Status badge — absolute top-right, never pushes layout */}
        <Box sx={{ position: 'absolute', top: 14, right: 14, px: 1.5, py: 0.4, borderRadius: 99, bgcolor: st.bg }}>
          <Typography sx={{ fontSize: 10, fontWeight: 700, color: st.color, whiteSpace: 'nowrap' }}>{status}</Typography>
        </Box>

        {/* Content — right padding reserves space for the badge */}
        <Box sx={{ pl: 1.5, pr: 9, pt: 2.5, pb: 2.5 }}>

          {/* Hotel header */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, mb: 1.75 }}>
            <Avatar
              src={booking.hotel?.logoUrl || undefined}
              sx={{ width: 36, height: 36, borderRadius: 2, background: BRAND_GRADIENT, fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0 }}
            >
              {!booking.hotel?.logoUrl && hotelName?.[0]?.toUpperCase()}
            </Avatar>
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
          <Box sx={{ height: 1, bgcolor: BORDER, mx: -0.5, mb: 1.5 }} />

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
          <Box sx={{ mt: 1.5, pt: 1.25, borderTop: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 10, color: TEXT_MUTED_DARK, fontFamily: 'monospace' }}>
              #{booking.id}
            </Typography>
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
};

export default BookingCard;
