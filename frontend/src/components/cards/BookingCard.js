import { Box, Typography } from '@mui/material';
import { NAVY, NAVY_GRADIENT, MUTED, BORDER, BG, SHADOW, SHADOW_HOVER, TEXT_MUTED_DARK, STATUS_ERROR, TEXT_FAINT_LIGHT } from '../../theme';
import { ROW_SX, StatusChip } from './AppCards';
import { motion } from 'framer-motion';
import PersonIcon from '@mui/icons-material/Person';
import NightsStayIcon from '@mui/icons-material/NightsStay';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import DescriptionIcon from '@mui/icons-material/Description';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import constants from '../../constants.json';

const getLuminance = (hex) => {
  const c = (hex || '').replace('#', '');
  if (c.length < 6) return 0;
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const fmtDate = (d) => d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const BookingCard = ({ data, navigate, onEdit, onDelete }) => {
  const booking = data;
  const hotelName = booking.hotel?.name || 'Unknown Hotel';
  const themeConfig = booking.hotel?.themeConfig || booking.hotel?.brand?.themeConfig;
  const primary = themeConfig?.primaryColor;
  const secondary = themeConfig?.secondaryColor;
  const accent = primary || constants.THEME_DEFAULTS.PRIMARY_COLOR;
  const headerGradient = primary
    ? `linear-gradient(135deg, ${primary} 0%, ${secondary || primary} 100%)`
    : NAVY_GRADIENT;
  // Navy default is dark — luminance ~0.02; treat no-primary as dark header
  const headerLuminance = primary ? getLuminance(primary) : 0;
  const badgeTextColor = headerLuminance > 0.35 ? '#000000' : '#ffffff';

  const start = booking.startTime ? new Date(booking.startTime) : null;
  const end = booking.endTime ? new Date(booking.endTime) : null;
  const nights = start && end ? Math.round((end - start) / 86400000) : 0;
  const now = new Date();
  const isActive = start && end && now >= start && now <= end;
  const isPast = end && now > end;
  const status = isActive ? 'Active' : isPast ? 'Past' : 'Upcoming';
  const guestName = booking.guest?.name || booking.guest?.email || null;
  const hasDoc = !!booking.reservationDocumentS3Key;

  return (
    <motion.div whileTap={{ scale: 0.98 }} whileHover={{ y: -3 }} transition={{ duration: 0.15 }} style={{ width: '100%' }}>
      <Box
        onClick={() => booking?.id && navigate?.(`/bookings/${booking.id}`)}
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 3,
          overflow: 'hidden',
          border: `1px solid ${primary ? primary + '30' : BORDER}`,
          boxShadow: primary ? `0 2px 12px ${primary}25` : SHADOW,
          cursor: 'pointer',
          display: 'flex', flexDirection: 'column', height: '100%',
          '@media (hover: hover)': {
            '&:hover': { boxShadow: primary ? `0 8px 28px ${primary}40` : SHADOW_HOVER },
          },
        }}
      >
        {/* Themed header */}
        <Box sx={{ background: headerGradient, px: 2.5, pt: 2, pb: 2, position: 'relative' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pr: 7 }}>
            {/* Logo tile */}
            <Box sx={{
              width: 42, height: 42, borderRadius: 1.5, flexShrink: 0,
              overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.18)',
              border: `2px solid ${TEXT_FAINT_LIGHT}`,
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
          {/* Status badge */}
          <Box sx={{ position: 'absolute', top: 14, right: 14, px: 1.5, py: 0.4, borderRadius: 99, bgcolor: 'rgba(0,0,0,0.22)' }}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: badgeTextColor, whiteSpace: 'nowrap' }}>{status}</Typography>
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{ px: 2.5, pt: 1.75, pb: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>

          {/* IN / OUT date badges + nights */}
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
            {[{ label: 'Check in', value: fmtDate(start) }, { label: 'Check out', value: fmtDate(end) }].map(({ label, value }) => (
              <Box key={label} sx={{
                flex: 1, borderRadius: 2, p: 1.1, textAlign: 'center',
                bgcolor: `${accent}12`, border: `1px solid ${accent}28`,
              }}>
                <Typography sx={{ fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{label}</Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: accent, lineHeight: 1.3, mt: 0.3 }}>{value}</Typography>
              </Box>
            ))}
            {nights > 0 && (
              <Box sx={{
                borderRadius: 2, px: 1.25, py: 1.1, textAlign: 'center',
                bgcolor: `${accent}12`, border: `1px solid ${accent}28`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.25,
              }}>
                <NightsStayIcon sx={{ fontSize: 12, color: MUTED }} />
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: accent, lineHeight: 1 }}>{nights}n</Typography>
              </Box>
            )}
          </Box>

          {/* Room + Guest row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
            {booking.roomNumber && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.5, borderRadius: 1.5, bgcolor: `${accent}12`, border: `1px solid ${accent}28` }}>
                <MeetingRoomIcon sx={{ fontSize: 12, color: accent }} />
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: accent }}>Room {booking.roomNumber}</Typography>
              </Box>
            )}
            {hasDoc && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.5, borderRadius: 1.5, bgcolor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <DescriptionIcon sx={{ fontSize: 12, color: '#6366f1' }} />
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#6366f1' }}>Doc</Typography>
              </Box>
            )}
          </Box>

          {guestName && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
              <PersonIcon sx={{ fontSize: 13, color: MUTED, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 12, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {guestName}
              </Typography>
            </Box>
          )}

          {/* Footer */}
          <Box sx={{ pt: 1, borderTop: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 'auto' }}>
            <Typography sx={{ fontSize: 10, color: TEXT_MUTED_DARK, fontFamily: 'monospace', opacity: 0.5 }}>#{booking.id}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: accent }}>View</Typography>
              <ArrowForwardIosIcon sx={{ fontSize: 9, color: accent }} />
            </Box>
          </Box>
        </Box>

        {/* Action strip */}
        {(onEdit || onDelete) && (
          <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'flex', borderTop: `1px solid ${BORDER}` }}>
            {onEdit && (
              <Box onClick={() => onEdit(booking)} sx={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75,
                py: 1.25, cursor: 'pointer', color: accent,
                '&:hover': { bgcolor: `${accent}10` },
                ...(onDelete && { borderRight: `1px solid ${BORDER}` }),
              }}>
                <EditIcon sx={{ fontSize: 13 }} />
                <Typography sx={{ fontSize: 12, fontWeight: 600 }}>Edit</Typography>
              </Box>
            )}
            {onDelete && (
              <Box onClick={() => onDelete(booking)} sx={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75,
                py: 1.25, cursor: 'pointer', color: STATUS_ERROR,
                '&:hover': { bgcolor: `${STATUS_ERROR}10` },
              }}>
                <DeleteOutlineIcon sx={{ fontSize: 13 }} />
                <Typography sx={{ fontSize: 12, fontWeight: 600 }}>Delete</Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </motion.div>
  );
};

export default BookingCard;

/** Compact booking row for dashboard lists — MapComponent-compatible. */
export function BookingRow({ data: b, navigate, now }) {
  const ciDate = b.startTime ? new Date(b.startTime) : null;
  const nights = ciDate && b.endTime ? Math.round((new Date(b.endTime) - ciDate) / 86400000) : null;
  const stayStatus = b.status === 'cancelled' ? 'cancelled'
    : (b.startTime && b.endTime && now >= new Date(b.startTime) && now <= new Date(b.endTime)) ? 'in_progress' : 'confirmed';
  return (
    <Box onClick={() => navigate(`/bookings/${b.id}`)} sx={{ ...ROW_SX, px: 2.5, py: 1.75, display: 'flex', alignItems: 'center', gap: 1.75 }}>
      {ciDate && (
        <Box sx={{ width: 42, height: 46, borderRadius: 1.5, border: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, bgcolor: BG }}>
          <Typography sx={{ fontSize: 9, fontWeight: 700, color: MUTED, letterSpacing: '0.06em' }}>{ciDate.toLocaleString('en-US', { month: 'short' }).toUpperCase()}</Typography>
          <Typography sx={{ fontSize: 17, fontWeight: 800, color: NAVY, lineHeight: 1 }}>{ciDate.getDate()}</Typography>
        </Box>
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.guest?.name || '—'}</Typography>
        <Typography sx={{ fontSize: 11.5, color: MUTED, mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {[b.hotel?.name || '—', nights && `${nights}n`, b.roomNumber && `Rm ${b.roomNumber}`].filter(Boolean).join(' · ')}
        </Typography>
      </Box>
      <StatusChip status={stayStatus} />
    </Box>
  );
}
