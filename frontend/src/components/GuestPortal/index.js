import React, { useEffect, useCallback, useRef } from 'react';
import { Box } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import constants from '../../constants.json';
import GuestHome from './GuestHome';
import GuestConcierge from './GuestConcierge';
import GuestRequests from './GuestRequests';
import GuestBottomNav from './GuestBottomNav';
import { useSocketVoice } from '../AvatarChatbot/hooks/useSocketVoice';

export default function GuestPortal({ booking, account, isMobile, alertError, alertSuccess, setLoading, navigate, sidebarOpen }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const logoUrl = booking?.hotel?.logoUrl || null;
  const { HOTEL_STAFF, HOTEL_OWNER } = constants.ACCOUNT_ROLES;
  const isNonGuest = account?.role === HOTEL_STAFF || account?.role === HOTEL_OWNER;
  const activeTab = searchParams.get('tab') || (isNonGuest ? 'requests' : 'home');
  const isChatMode = searchParams.get('mode') === 'chat';
  const isConcierge = activeTab === 'concierge';
  const hideNav = isConcierge && isChatMode;
  const fullScreen = isConcierge;

  // Booking portal: voice/chat availability follows the booking stay window for all roles.
  const isWithinStay = !!booking?.isWithinStay;

  // ── Voice socket pre-warm ─────────────────────────────────────────────────
  // Keep socket alive across tabs so suggestions from Home tab respond instantly.
  const promptRef = useRef(searchParams.get('prompt') || '');
  const promptSentRef = useRef(false);
  const hasInteractedRef = useRef(false);
  const userStoppedRef = useRef(false);
  const sendTextRef = useRef(null);
  const startRecordingRef = useRef(null);

  // Sync promptRef from URL on every render (only while not yet sent)
  if (!promptSentRef.current) {
    promptRef.current = searchParams.get('prompt') || '';
  }

  const voiceBookingId = isWithinStay && !isChatMode ? booking?.id : null;

  const handleVoiceReady = useCallback(() => {
    if (promptRef.current && !promptSentRef.current) {
      promptSentRef.current = true;
      hasInteractedRef.current = true;
      sendTextRef.current?.(promptRef.current);
      setSearchParams({ tab: 'concierge' }, { replace: true });
      return;
    }
    // Only auto-restart mic after user has explicitly interacted (mic tap or chip tap)
    if (activeTab === 'concierge' && isWithinStay && hasInteractedRef.current && !userStoppedRef.current) {
      startRecordingRef.current?.();
    }
  }, [setSearchParams, isWithinStay, activeTab]);

  const { isReady, isRecording, isProcessing, isSpeaking, startRecording, stopRecording, sendText } = useSocketVoice({
    bookingId: voiceBookingId,
    setLoading,
    onReady: handleVoiceReady,
    onError: (err) => alertError?.(err),
  });

  sendTextRef.current = sendText;
  startRecordingRef.current = startRecording;

  const setActiveTab = useCallback((tab, prompt, mode) => {
    const params = { tab };
    if (mode) params.mode = mode;

    if (tab === 'concierge' && prompt) {
      if (isReady && !promptSentRef.current) {
        // Socket already authenticated — send immediately, skip URL prompt
        promptSentRef.current = true;
        hasInteractedRef.current = true;
        userStoppedRef.current = false;
        sendTextRef.current?.(prompt);
      } else {
        // Cold start — put prompt in URL for handleVoiceReady to pick up
        params.prompt = prompt;
        promptRef.current = prompt;
        promptSentRef.current = false;
      }
    }

    setSearchParams(params);
  }, [setSearchParams, isReady]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [activeTab]);

  useEffect(() => {
    document.body.style.overflow = fullScreen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [fullScreen]);


  if (!booking) return null;

  const voiceProps = {
    isReady,
    isRecording,
    isProcessing,
    isSpeaking,
    startRecording,
    stopRecording,
    sendText,
    hasInteractedRef,
    userStoppedRef,
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'home':
        if (isNonGuest) { setActiveTab('requests'); return null; }
        return (
          <GuestHome
            booking={booking}
            account={account}
            onTabChange={setActiveTab}
            navigate={navigate}
            setLoading={setLoading}
            alertError={alertError}
            logoUrl={logoUrl}
          />
        );
      case 'concierge':
        if (isNonGuest) { setActiveTab('requests'); return null; }
        return (
          <GuestConcierge
            booking={booking}
            accountRole={account?.role}
            alertError={alertError}
            isWithinStay={isWithinStay}
            isMobile={isMobile}
            setLoading={setLoading}
            logoUrl={logoUrl}
            {...voiceProps}
          />
        );
      case 'requests':
        return (
          <GuestRequests
            booking={booking}
            alertError={alertError}
            setLoading={setLoading}
            logoUrl={logoUrl}
            navigate={navigate}
          />
        );
      default:
        return (
          <GuestHome
            booking={booking}
            account={account}
            onTabChange={setActiveTab}
            navigate={navigate}
            setLoading={setLoading}
            alertError={alertError}
            logoUrl={logoUrl}
          />
        );
    }
  };

  if (fullScreen) {
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
          zIndex: 10,
          px: { xs: 0, md: 4 },
          py: { xs: 0, md: 0 },
        }}
      >
        {renderTab()}
        {!hideNav && <GuestBottomNav activeTab={activeTab} onTabChange={setActiveTab} isMobile={isMobile} sidebarOpen={sidebarOpen} account={account} />}
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', minHeight: '100dvh', bgcolor: 'background.default', pt: { xs: 'calc(var(--app-header-height) + 2svh)', md: '4svh' } }}>
      {renderTab()}
      <GuestBottomNav activeTab={activeTab} onTabChange={setActiveTab} isMobile={isMobile} sidebarOpen={sidebarOpen} account={account} />
    </Box>
  );
}
