import React, { useEffect, useCallback } from 'react';
import { Box } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import GuestHome from './GuestHome';
import GuestConcierge from './GuestConcierge';
import GuestRequests from './GuestRequests';
import GuestBottomNav from './GuestBottomNav';

export default function GuestPortal({ booking, account, isMobile, alertError, setLoading, navigate }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'home';

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
        return (
          <GuestHome
            booking={booking}
            account={account}
            onTabChange={setActiveTab}
            navigate={navigate}
            setLoading={setLoading}
            alertError={alertError}
          />
        );
      case 'concierge':
        return (
          <GuestConcierge
            booking={booking}
            alertError={alertError}
            isWithinStay={account?.role !== 'guest' ? true : booking.isWithinStay}
            isMobile={isMobile}
            setLoading={setLoading}
          />
        );
      case 'requests':
        return (
          <GuestRequests
            booking={booking}
            alertError={alertError}
            setLoading={setLoading}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Box sx={{ position: 'relative', minHeight: '100vh', bgcolor: '#F8F7F4', pt: isMobile ? '5vh' : 0 }}>
      {renderTab()}
      <GuestBottomNav activeTab={activeTab} onTabChange={setActiveTab} isMobile={isMobile} />
    </Box>
  );
}
