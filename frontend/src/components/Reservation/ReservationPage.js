import { useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Avatar, Box, Typography, Button } from '@mui/material';
import HotelIcon from '@mui/icons-material/Hotel';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import MicIcon from '@mui/icons-material/Mic';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import ReservationChat from './ReservationChat';
import ReservationVoice from './ReservationVoice';
import { NAVY, MUTED, BORDER, BRAND_GRADIENT, PRIMARY_CONTRAST, SHADOW, SHADOW_PANEL } from '../../theme';
import constants from '../../constants.json';

// Errors that mean the conversation can never start — a mistyped link, a stale
// QR code, a deleted property. Anything else (a rate limit, a failed message)
// leaves the chat usable and only deserves a toast.
const FATAL_ERRORS = [
  constants.ERROR_RESERVATION_HOTEL_NOT_FOUND,
  constants.ERROR_RESERVATION_HOTEL_REQUIRED,
  constants.ERROR_RESERVATION_SETUP_FAILED,
];

/**
 * Public reservation page — one shareable link per property, no login.
 *
 * Self-contained by design: it renders its own chat rather than the signed-in
 * concierge's, so nothing here can affect a guest's or a staff member's chat.
 */
export default function ReservationPage({ alertError }) {
  const { hotelId } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isVoice = pathname.endsWith('/voice');
  const [hotel, setHotel] = useState(null);
  const [fatalError, setFatalError] = useState('');

  // A toast fades; someone who followed a dead link needs to still see why the
  // page is not working after it does.
  const handleError = (message) => {
    if (FATAL_ERRORS.includes(message)) {
      setFatalError(message);
    }
  };

  return (
    <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          px: { xs: 2, md: 4 },
          py: { xs: 1.5, md: 2 },
          borderBottom: `1px solid ${BORDER}`,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexShrink: 0,
        }}
      >
        <Avatar
          src={hotel?.logoUrl || undefined}
          sx={{ width: 40, height: 40, background: BRAND_GRADIENT, color: PRIMARY_CONTRAST, boxShadow: SHADOW }}
        >
          <HotelIcon fontSize="small" />
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography noWrap sx={{ fontWeight: 700, fontSize: { xs: 15, md: 17 }, color: NAVY, lineHeight: 1.2 }}>
            {hotel?.name || constants.RESERVATION_TITLE}
          </Typography>
          <Typography noWrap sx={{ fontSize: { xs: 11, md: 12 }, color: MUTED, mt: 0.2 }}>
            {hotel?.address || constants.RESERVATION_SUBTITLE}
          </Typography>
        </Box>
        {!fatalError && (
          <Button
            size="small"
            startIcon={isVoice ? <ChatBubbleOutlineIcon sx={{ fontSize: 16 }} /> : <MicIcon sx={{ fontSize: 16 }} />}
            onClick={() => navigate(isVoice ? `/reservation/${hotelId}` : `/reservation/${hotelId}/voice`)}
            sx={{ ml: 'auto', flexShrink: 0, textTransform: 'none', color: NAVY, fontSize: 12 }}
          >
            {isVoice ? constants.RESERVATION_VOICE_SWITCH_TO_TEXT : constants.RESERVATION_VOICE_SWITCH_TO_VOICE}
          </Button>
        )}
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center', px: { xs: 0, md: 4 }, py: { xs: 0, md: 2 } }}>
        {fatalError ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', px: 3, gap: 1.5 }}>
            <SearchOffIcon sx={{ fontSize: 56, color: MUTED }} />
            <Typography sx={{ fontWeight: 700, fontSize: { xs: 20, md: 24 }, color: NAVY }}>{fatalError}</Typography>
            <Typography sx={{ fontSize: 14, color: MUTED, maxWidth: 420, lineHeight: 1.6 }}>
              {constants.RESERVATION_FATAL_HELP}
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              width: '100%',
              maxWidth: { md: 900 },
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: { md: 4 },
              overflow: 'hidden',
              border: { md: `1px solid ${BORDER}` },
              boxShadow: { md: SHADOW_PANEL },
            }}
          >
            {isVoice ? (
              <ReservationVoice
                hotelId={hotelId}
                onHotelResolved={setHotel}
                onFatalError={handleError}
                alertError={alertError}
              />
            ) : (
              <ReservationChat
                hotelId={hotelId}
                onHotelResolved={setHotel}
                onFatalError={handleError}
                alertError={alertError}
              />
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
