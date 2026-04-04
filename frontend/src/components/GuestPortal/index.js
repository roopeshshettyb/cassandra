import React, { useEffect, useCallback } from 'react';
import { Box } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import constants from '../../constants.json';
import GuestHome from './GuestHome';
import GuestConcierge from './GuestConcierge';
import GuestRequests from './GuestRequests';
import GuestBottomNav from './GuestBottomNav';

export default function GuestPortal({ booking, account, isMobile, alertError, alertSuccess, setLoading, navigate, sidebarOpen }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const logoUrl = booking?.hotel?.logoUrl || null;
  const { HOTEL_STAFF, HOTEL_OWNER, GUEST } = constants.ACCOUNT_ROLES;
  const isNonGuest = account?.role === HOTEL_STAFF || account?.role === HOTEL_OWNER;
  const activeTab = searchParams.get('tab') || (isNonGuest ? 'requests' : 'home');
  const isChatMode = searchParams.get('mode') === 'chat';
  const isConcierge = isMobile && activeTab === 'concierge';
  const hideNav = isConcierge && isChatMode;
  const fullScreen = isConcierge; // lock scroll + hide footer for both voice and chat

  const setActiveTab = useCallback((tab) => {
    setSearchParams({ tab });
  }, [setSearchParams]);

  // Scroll to top whenever the tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [activeTab]);

  // Lock body scroll when in full-screen mode (concierge on mobile)
  useEffect(() => {
    document.body.style.overflow = fullScreen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [fullScreen]);

  if (!booking) return null;

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
            alertError={alertError}
            isWithinStay={account?.role !== GUEST ? true : booking.isWithinStay}
            isMobile={isMobile}
            setLoading={setLoading}
            logoUrl={logoUrl}
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
        // Fallback to home if tab is unknown
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
      <Box sx={{ position: 'fixed', top: '5vh', left: 0, right: 0, bottom: 0, bgcolor: 'background.default', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
        {renderTab()}
        {!hideNav && <GuestBottomNav activeTab={activeTab} onTabChange={setActiveTab} isMobile={isMobile} sidebarOpen={sidebarOpen} account={account} />}
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', minHeight: '100dvh', bgcolor: 'background.default', pt: { xs: '10vh', md: '3vh' } }}>
      {renderTab()}
      <GuestBottomNav activeTab={activeTab} onTabChange={setActiveTab} isMobile={isMobile} sidebarOpen={sidebarOpen} account={account} />
    </Box>
  );
}
