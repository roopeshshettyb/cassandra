import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { BRAND_GRADIENT, NAVY, MUTED, BORDER, SHADOW, SHADOW_HOVER, TEXT_MUTED_DARK } from '../../theme';
import { REQUEST_STATUS, REQUEST_TYPE_LABEL, extractFirstNote } from '../../constants/requestConfig';
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
        onClick={() => req?.bookingId && navigate?.(`/bookings/${req.bookingId}`)}
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 3,
          p: 2.5,
          border: `1px solid ${BORDER}`,
          boxShadow: SHADOW,
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          '&:hover': { boxShadow: SHADOW_HOVER },
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
