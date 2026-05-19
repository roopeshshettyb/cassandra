import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import RoomServiceIcon from '@mui/icons-material/RoomService';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import LocalLaundryServiceIcon from '@mui/icons-material/LocalLaundryService';
import AirportShuttleIcon from '@mui/icons-material/AirportShuttle';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { BRAND_GRADIENT, NAVY, MUTED, BORDER, SHADOW, SHADOW_HOVER, TEXT_MUTED_DARK, HOVER_BG, STATUS_WARNING_BG, STATUS_WARNING, STATUS_INFO_BG, STATUS_SUCCESS_BG, STATUS_SUCCESS, STATUS_ERROR_BG, STATUS_ERROR } from '../../theme';
import { REQUEST_STATUS, REQUEST_TYPE_LABEL, extractFirstNote } from '../../constants/requestConfig';
import { ROW_SX, StatusChip, timeAgo } from './AppCards';
import constants from '../../constants.json';

dayjs.extend(relativeTime);

const RequestCard = ({ data, navigate, account }) => {
  const req = data;
  const isGuest = account?.role === constants.ACCOUNT_ROLES.GUEST;
  const firstNote = extractFirstNote(isGuest ? req.staffNotes : req.userNotes);
  const title = REQUEST_TYPE_LABEL[req.requestType] || req.requestType || 'Request';
  const hotelName = req.hotel?.name || null;
  const guestName = req.guest?.name || req.guest?.email || null;
  const st = REQUEST_STATUS[req.status] || REQUEST_STATUS.pending;
  const StatusIcon = st.icon;

  return (
    <motion.div whileTap={{ scale: 0.98 }} whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
      <Box
        onClick={() => req?.id && navigate?.(`/requests/${req.id}`)}
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 3,
          p: 2.5,
          border: `1px solid ${BORDER}`,
          boxShadow: SHADOW,
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          '@media (hover: hover)': { '&:hover': { boxShadow: SHADOW_HOVER } },
        }}
      >
        {/* Gold left accent */}
        <Box sx={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: BRAND_GRADIENT, borderRadius: '3px 0 0 3px' }} />

        <Box sx={{ pl: 0.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Box sx={{ flex: 1, mr: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14, color: NAVY, lineHeight: 1.3 }}>{title}</Typography>
              {guestName && <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.25 }}>{guestName}</Typography>}
              {hotelName && <Typography sx={{ fontSize: 11, color: TEXT_MUTED_DARK, mt: 0.15 }}>{hotelName}</Typography>}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.4, borderRadius: 99, bgcolor: st.bg, flexShrink: 0 }}>
              <motion.div
                animate={st.spin ? { rotate: 360 } : {}}
                transition={st.spin ? { duration: 1.5, repeat: Infinity, ease: 'linear' } : {}}
                style={{ display: 'flex', alignItems: 'center' }}
              >
                <StatusIcon sx={{ fontSize: 11, color: st.color }} />
              </motion.div>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: st.color }}>{st.label}</Typography>
            </Box>
          </Box>

          {firstNote && (
            <Typography sx={{ fontSize: 12, color: MUTED, mb: 1, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {firstNote}
            </Typography>
          )}

          <Typography sx={{ fontSize: 11, color: TEXT_MUTED_DARK }}>
            {req.createdAt ? dayjs(req.createdAt).fromNow() : ''}
          </Typography>
        </Box>
      </Box>
    </motion.div>
  );
};

export default RequestCard;

// ── Dashboard compact rows ──────────────────────────────────────────────────

const REQUEST_TYPE_CONFIG = {
  room_service:     { Icon: RoomServiceIcon,        bg: STATUS_WARNING_BG, color: STATUS_WARNING },
  house_keeping:    { Icon: CleaningServicesIcon,    bg: STATUS_INFO_BG,    color: STATUS_WARNING },
  laundry:          { Icon: LocalLaundryServiceIcon, bg: STATUS_SUCCESS_BG, color: STATUS_SUCCESS },
  airport_transfer: { Icon: AirportShuttleIcon,      bg: STATUS_ERROR_BG,   color: STATUS_ERROR },
};

function RequestIcon({ requestType }) {
  const cfg = REQUEST_TYPE_CONFIG[requestType];
  const Icon = cfg?.Icon || HelpOutlineIcon;
  return (
    <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: cfg?.bg || HOVER_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.25 }}>
      <Icon sx={{ fontSize: 16, color: cfg?.color || MUTED }} />
    </Box>
  );
}

function shortName(name) {
  if (!name) return null;
  return name.split(' ').filter(Boolean).map((p, i) => (i === 0 ? p[0] + '.' : p)).join(' ');
}

/** Compact request row for dashboard lists — MapComponent-compatible. */
export function RequestRow({ data: r, navigate }) {
  return (
    <Box onClick={() => navigate(`/requests/${r.id}`)} sx={{ ...ROW_SX, px: 2, py: 1.5, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
      <RequestIcon requestType={r.requestType} style={{ bg: HOVER_BG, color: MUTED }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: NAVY }}>
            {r.hotel?.name || '—'}
            {r.booking?.roomNumber && <Box component="span" sx={{ color: MUTED, fontWeight: 600 }}> · Rm {r.booking.roomNumber}</Box>}
          </Typography>
          <StatusChip status={r.status} />
        </Box>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.45, textTransform: 'capitalize' }}>
          {REQUEST_TYPE_LABEL[r.requestType] || String(r.requestType || '').replace(/_/g, ' ')}
        </Typography>
        <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.4 }}>{timeAgo(r.createdAt)}</Typography>
      </Box>
    </Box>
  );
}

/** Action queue item — icon by type, hotel name, desc, "via" guest. MapComponent-compatible. */
export function ActionItem({ data: r, navigate }) {
  const desc = extractFirstNote(r.userNotes) || ((REQUEST_TYPE_LABEL[r.requestType] || String(r.requestType || '').replace(/_/g, ' ')) + (r.booking?.roomNumber ? ` · Rm ${r.booking.roomNumber}` : ''));
  return (
    <Box onClick={() => navigate(`/requests/${r.id}`)} sx={{ ...ROW_SX, px: 2.5, py: 1.5, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
      <RequestIcon requestType={r.requestType} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.35 }}>
          <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.hotel?.name || '—'}</Typography>
          <Typography sx={{ fontSize: 10.5, color: MUTED, flexShrink: 0 }}>{timeAgo(r.createdAt)}</Typography>
        </Box>
        <Typography sx={{ fontSize: 12.5, color: 'text.primary', lineHeight: 1.45, mb: 0.35, textTransform: 'capitalize' }}>{desc}</Typography>
        {shortName(r.guest?.name) && <Typography sx={{ fontSize: 11, color: MUTED }}>via {shortName(r.guest?.name)}</Typography>}
      </Box>
    </Box>
  );
}
