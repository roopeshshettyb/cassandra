import React, { useState } from 'react';
import { Box } from '@mui/material';
import GuestHome from './GuestHome';
import GuestConcierge from './GuestConcierge';
import GuestRequests from './GuestRequests';
import GuestBottomNav from './GuestBottomNav';

export default function GuestPortal({ booking, account, isMobile, alertError, setLoading, navigate }) {
  const [activeTab, setActiveTab] = useState('home');

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
    <Box sx={{ position: 'relative', minHeight: '100vh', bgcolor: '#F8F7F4' }}>
      {renderTab()}
      <GuestBottomNav activeTab={activeTab} onTabChange={setActiveTab} isMobile={isMobile} />
    </Box>
  );
}
