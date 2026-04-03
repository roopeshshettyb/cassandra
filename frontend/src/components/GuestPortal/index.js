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

  const setActiveTab = useCallback((tab) => {
    setSearchParams({ tab });
  }, [setSearchParams]);

  // Scroll to top whenever the tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [activeTab]);

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
            account={account}
            alertError={alertError}
            alertSuccess={alertSuccess}
            setLoading={setLoading}
            initialRequestId={searchParams.get('requestId') ? Number(searchParams.get('requestId')) : null}
            logoUrl={logoUrl}
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

  return (
    <Box sx={{ position: 'relative', minHeight: '100vh', bgcolor: 'background.default', pt: isMobile ? '5vh' : 0 }}>
      {renderTab()}
      <GuestBottomNav activeTab={activeTab} onTabChange={setActiveTab} isMobile={isMobile} sidebarOpen={sidebarOpen} account={account} />
    </Box>
  );
}
