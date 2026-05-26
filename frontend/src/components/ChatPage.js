import { Box } from '@mui/material';
import GuestConcierge from './GuestPortal/GuestConcierge';

export default function ChatPage({
  isMobile,
  accountRole,
  alertError,
  conciergeVoiceReady,
  conciergeRecording,
  conciergeProcessing,
  conciergeSpeaking,
  conciergeStartRecording,
  conciergeStopRecording,
  conciergeSendText,
  conciergeInteractedRef,
  conciergeStoppedRef,
  conciergeMode,
  setConciergeMode,
}) {
  return (
    <Box
      sx={{
        position: 'fixed',
        top: { xs: 'var(--app-header-height)', md: '4svh' },
        left: isMobile ? 0 : '20vw',
        right: 0,
        bottom: 0,
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        px: { xs: 0, md: 4 },
        py: { xs: 0, md: 0 },
      }}
    >
      <GuestConcierge
        booking={null}
        accountRole={accountRole}
        bookingIdOverride={null}
        alertError={alertError}
        isWithinStay
        isMobile={isMobile}
        logoUrl={null}
        isReady={conciergeVoiceReady}
        isRecording={conciergeRecording}
        isProcessing={conciergeProcessing}
        isSpeaking={conciergeSpeaking}
        startRecording={conciergeStartRecording}
        stopRecording={conciergeStopRecording}
        sendText={conciergeSendText}
        hasInteractedRef={conciergeInteractedRef}
        userStoppedRef={conciergeStoppedRef}
        mode={conciergeMode}
        onModeChange={setConciergeMode}
      />
    </Box>
  );
}
