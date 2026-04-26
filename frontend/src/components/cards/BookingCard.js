import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import PersonIcon from '@mui/icons-material/Person';
import NightsStayIcon from '@mui/icons-material/NightsStay';

import { NAVY_GRADIENT, MUTED, BORDER, SHADOW, SHADOW_HOVER, STATUS_SUCCESS, STATUS_SUCCESS_BG, STATUS_INFO, STATUS_INFO_BG, STATUS_ERROR, STATUS_ERROR_BG, TEXT_MUTED_DARK } from '../../theme';

const statusConfig = {
  Active:    { color: STATUS_SUCCESS, bg: STATUS_SUCCESS_BG },
  Upcoming:  { color: STATUS_INFO,    bg: STATUS_INFO_BG },
  Past:      { color: MUTED,          bg: TEXT_MUTED_DARK },
  Cancelled: { color: STATUS_ERROR,   bg: STATUS_ERROR_BG },
};

const fmtDate = (d) => d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const BookingCard = ({ data, navigate }) => {
  const booking = data;
  const hotelName = booking.hotel?.name || 'Unknown Hotel';
  const primary = booking.hotel?.themeConfig?.primaryColor;
  const secondary = booking.hotel?.themeConfig?.secondaryColor;
  const accent = primary || '#D4AF37';
  const headerGradient = primary
    ? `linear-gradient(135deg, ${primary} 0%, ${secondary || primary} 100%)`
    : NAVY_GRADIENT;

  const start = booking.startTime ? new Date(booking.startTime) : null;
  const end = booking.endTime ? new Date(booking.endTime) : null;
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
    <motion.div whileTap={{ scale: 0.98 }} whileHover={{ y: -3 }} transition={{ duration: 0.15 }}>
      <Box
        onClick={() => booking?.id && navigate?.(`/bookings/${booking.id}`)}
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
        {/* Themed header — hotel logo + name + status badge */}
        <Box sx={{ background: headerGradient, px: 2.5, pt: 2, pb: 2, position: 'relative' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pr: 7 }}>
            {/* Logo tile */}
            <Box sx={{
              width: 42, height: 42, borderRadius: 1.5, flexShrink: 0,
              overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.18)',
              border: '2px solid rgba(255,255,255,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            }}>
              {booking.hotel?.logoUrl
                ? <Box component="img" src={booking.hotel.logoUrl} alt={hotelName}
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : null}
              <Box sx={{ display: booking.hotel?.logoUrl ? 'none' : 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#fff', lineHeight: 1 }}>
                  {hotelName[0]?.toUpperCase()}
                </Typography>
              </Box>
            </Box>
            <Typography sx={{
              fontWeight: 700, fontSize: 14, color: '#fff', lineHeight: 1.3,
              overflow: 'hidden', textOverflow: 'ellipsis',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {hotelName}
            </Typography>
          </Box>
          {/* Status badge — top right of header */}
          <Box sx={{ position: 'absolute', top: 14, right: 14, px: 1.5, py: 0.4, borderRadius: 99, bgcolor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.3)' }}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>{status}</Typography>
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{ px: 2.5, pt: 1.75, pb: 2 }}>
          {/* IN / OUT date badges */}
          <Box sx={{ display: 'flex', gap: 1, mb: 1.75 }}>
            {[{ label: 'Check in', value: fmtDate(start) }, { label: 'Check out', value: fmtDate(end) }].map(({ label, value }) => (
              <Box key={label} sx={{
                flex: 1, borderRadius: 2, p: 1.1, textAlign: 'center',
                bgcolor: `${accent}12`, border: `1px solid ${accent}28`,
              }}>
                <Typography sx={{ fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{label}</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: accent, lineHeight: 1.3, mt: 0.3 }}>{value}</Typography>
              </Box>
            ))}
            {nights > 0 && (
              <Box sx={{
                borderRadius: 2, px: 1.25, py: 1.1, textAlign: 'center',
                bgcolor: `${accent}12`, border: `1px solid ${accent}28`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.25,
              }}>
                <NightsStayIcon sx={{ fontSize: 13, color: MUTED }} />
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: accent, lineHeight: 1 }}>{nights}n</Typography>
              </Box>
            )}
          </Box>

          {/* Guest */}
          {guestName && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
              <PersonIcon sx={{ fontSize: 13, color: MUTED, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 12, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {guestName}
              </Typography>
            </Box>
          )}

          {/* Footer */}
          <Box sx={{ pt: 1, borderTop: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 10, color: TEXT_MUTED_DARK, fontFamily: 'monospace', opacity: 0.5 }}>#{booking.id}</Typography>
            {booking.roomNumber && (
              <Typography sx={{ fontSize: 10, fontWeight: 600, color: MUTED }}>Room {booking.roomNumber}</Typography>
            )}
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
};

export default BookingCard;
