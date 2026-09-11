import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import PhoneIcon from '@mui/icons-material/Phone';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { BRAND_GRADIENT, NAVY, MUTED, BORDER, SHADOW, SHADOW_HOVER, PRIMARY_CONTRAST, STATUS_SUCCESS, STATUS_SUCCESS_BG, STATUS_WARNING, STATUS_WARNING_BG } from '../../theme';
import constants from '../../constants.json';

dayjs.extend(relativeTime);

/**
 * Day + month label, e.g. "20 Nov".
 *
 * Deliberately not dayjs `format('D MMM')`: src/utils/dayjsConfig replaces the
 * whole `en` locale with one that only defines relativeTime, so any month-name
 * token reads off an undefined months array and throws. Intl has its own data
 * and is unaffected.
 */
function dayMonth(value, withYear) {
  const parsed = dayjs(value);
  if (!parsed.isValid()) return '';
  return parsed.toDate().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

function Detail({ icon: Icon, children }) {
  if (!children) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
      <Icon sx={{ fontSize: 15, color: MUTED, flexShrink: 0 }} />
      <Typography noWrap sx={{ fontSize: 13, color: NAVY }}>{children}</Typography>
    </Box>
  );
}

/**
 * One reservation conversation. A conversation only becomes a booking enquiry
 * once the agent has captured the details, so the two states look different:
 * captured details get the guest's name and dates, the rest show what the
 * visitor was last told.
 */
const AiBookingCard = ({ data }) => {
  // The newest capture wins — a visitor can amend details mid-conversation.
  const enquiry = data.enquiries?.length ? data.enquiries[data.enquiries.length - 1] : null;
  const nights =
    enquiry?.checkInDate && enquiry?.checkOutDate
      ? dayjs(enquiry.checkOutDate).diff(dayjs(enquiry.checkInDate), 'day')
      : null;

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }} style={{ width: '100%' }}>
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
          p: 2,
          borderRadius: 3,
          border: `1px solid ${BORDER}`,
          bgcolor: 'background.paper',
          boxShadow: SHADOW,
          '&:hover': { boxShadow: SHADOW_HOVER },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: NAVY, minWidth: 0 }} noWrap>
            {enquiry?.guestName || constants.AI_BOOKINGS_NO_DETAILS}
          </Typography>
          <Box
            sx={{
              flexShrink: 0,
              px: 1,
              py: 0.3,
              borderRadius: 5,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.4,
              color: enquiry ? STATUS_SUCCESS : STATUS_WARNING,
              bgcolor: enquiry ? STATUS_SUCCESS_BG : STATUS_WARNING_BG,
            }}
          >
            {enquiry ? constants.AI_BOOKINGS_STATUS_CAPTURED : constants.AI_BOOKINGS_STATUS_BROWSING}
          </Box>
        </Box>

        {enquiry ? (
          <>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.25,
                py: 0.9,
                borderRadius: 2,
                background: BRAND_GRADIENT,
                color: PRIMARY_CONTRAST,
              }}
            >
              <EventAvailableIcon sx={{ fontSize: 17 }} />
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                {dayMonth(enquiry.checkInDate)} – {dayMonth(enquiry.checkOutDate, true)}
                {nights > 0 ? ` · ${nights} night${nights > 1 ? 's' : ''}` : ''}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
              <Detail icon={PersonOutlineIcon}>
                {enquiry.partySize ? `${enquiry.partySize} guest${enquiry.partySize > 1 ? 's' : ''}` : null}
                {enquiry.roomPreference ? ` · ${enquiry.roomPreference}` : ''}
              </Detail>
              <Detail icon={MailOutlineIcon}>{enquiry.guestEmail}</Detail>
              <Detail icon={PhoneIcon}>{enquiry.guestPhone}</Detail>
            </Box>
            {enquiry.specialRequests && (
              <Typography sx={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>
                “{enquiry.specialRequests}”
              </Typography>
            )}
          </>
        ) : (
          <Typography
            sx={{ fontSize: 13, color: MUTED, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {data.lastMessage?.content || constants.AI_BOOKINGS_NO_MESSAGES}
          </Typography>
        )}

        <Box sx={{ mt: 'auto', pt: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <ChatBubbleOutlineIcon sx={{ fontSize: 14, color: MUTED }} />
            <Typography sx={{ fontSize: 11, color: MUTED }}>{data.messageCount || 0}</Typography>
          </Box>
          <Typography sx={{ fontSize: 11, color: MUTED }}>
            {dayjs(enquiry?.recordedAt || data.createdAt).fromNow()}
          </Typography>
        </Box>
      </Box>
    </motion.div>
  );
};

export default AiBookingCard;
