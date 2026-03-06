import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import GuestHome from './GuestHome';
import GuestConcierge from './GuestConcierge';
import GuestRequests from './GuestRequests';
import GuestBottomNav from './GuestBottomNav';

export default function GuestPortal({ booking, account, isMobile, alertError, setLoading, navigate }) {
  const [activeTab, setActiveTab] = useState('home');

  // Scroll to top whenever the tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [activeTab]);

  // When on concierge tab, push a history entry so the top-right back arrow
  // returns to the Home tab instead of leaving the booking page entirely.
  useEffect(() => {
    if (activeTab !== 'concierge') return;
    window.history.pushState({ guestPortalTab: 'concierge' }, '');
    const handlePopState = () => setActiveTab('home');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
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
          />
        );
      case 'concierge':
        return (
          <GuestConcierge
            booking={booking}
            account={account}
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
    <Box sx={{ position: 'relative', minHeight: '100vh', bgcolor: '#F8F7F4', pt: isMobile ? '7vh' : 0 }}>
      {renderTab()}
      <GuestBottomNav activeTab={activeTab} onTabChange={setActiveTab} isMobile={isMobile} />
    </Box>
  );
}
