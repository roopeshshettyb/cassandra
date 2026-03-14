import React from 'react';
import { Box, Paper } from '@mui/material';
import { motion } from 'framer-motion';
import HomeIcon from '@mui/icons-material/Home';
import MicIcon from '@mui/icons-material/Mic';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { BRAND_GRADIENT, BORDER, NAV_BG } from '../../theme';

const tabs = [
  { id: 'home', icon: HomeIcon, label: 'Home' },
  { id: 'concierge', icon: MicIcon, label: 'Concierge' },
  { id: 'requests', icon: AccessTimeIcon, label: 'Requests' },
];

export default function GuestBottomNav({ activeTab, onTabChange, isMobile, sidebarOpen, account }) {
  if (!isMobile) return null;
  const isNonGuest = account?.role === 'hotel_staff' || account?.role === 'hotel_owner';
  const visibleTabs = isNonGuest ? tabs.filter((t) => t.id !== 'home') : tabs;
  return (
    <Paper
      elevation={0}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: isMobile ? 0 : '20vw',
        right: 0,
        zIndex: 1100,
        bgcolor: NAV_BG,
        backdropFilter: 'blur(14px)',
        borderTop: `1px solid ${BORDER}`,
        borderRadius: 0,
        display: (isMobile && sidebarOpen) ? 'none' : 'block',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          py: 0.75,
          px: 1,
          maxWidth: 640,
          mx: 'auto',
        }}
      >
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <Box
              key={tab.id}
              component={motion.div}
              whileTap={{ scale: 0.93 }}
              onClick={() => onTabChange(tab.id)}
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.4,
                py: 1,
                cursor: 'pointer',
                position: 'relative',
                borderRadius: 2.5,
                border: '1.5px solid',
                borderColor: isActive ? 'primary.main' : 'transparent',
                transition: 'border-color 0.2s ease',
                userSelect: 'none',
              }}
            >
              {isActive && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: -2,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 24,
                    height: 3,
                    borderRadius: 99,
                    background: BRAND_GRADIENT,
                  }}
                />
              )}
              <Icon
                sx={{
                  fontSize: 20,
                  color: isActive ? 'primary.main' : 'text.secondary',
                  transition: 'color 0.2s ease',
                }}
              />
              <Box
                component="span"
                sx={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  color: isActive ? 'text.primary' : 'text.secondary',
                  transition: 'color 0.2s ease',
                  lineHeight: 1,
                }}
              >
                {tab.label}
              </Box>
            </Box>
          );
        })}
      </Box>
      {/* Safe area for mobile */}
      <Box sx={{ height: 'env(safe-area-inset-bottom, 0px)', bgcolor: NAV_BG }} />
    </Paper>
  );
}
