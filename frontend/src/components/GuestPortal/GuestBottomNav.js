import React from 'react';
import { Box, Paper } from '@mui/material';
import { motion } from 'framer-motion';
import HomeIcon from '@mui/icons-material/Home';
import MicIcon from '@mui/icons-material/Mic';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

const tabs = [
  { id: 'home', icon: HomeIcon, label: 'Home' },
  { id: 'concierge', icon: MicIcon, label: 'Concierge' },
  { id: 'requests', icon: AccessTimeIcon, label: 'Requests' },
];

export default function GuestBottomNav({ activeTab, onTabChange, isMobile }) {
  return (
    <Paper
      elevation={0}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: isMobile ? 0 : '20vw',
        right: 0,
        zIndex: 1200,
        bgcolor: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(14px)',
        borderTop: '1px solid rgba(0,0,0,0.07)',
        borderRadius: 0,
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
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <Box
              key={tab.id}
              component={motion.div}
              whileTap={{ scale: 0.93 }}
              onClick={() => onTabChange(tab.id)}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.4,
                py: 1,
                px: { xs: 2.5, sm: 3.5 },
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
                <motion.div
                  layoutId="nav-top-bar"
                  style={{
                    position: 'absolute',
                    top: -2,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 24,
                    height: 3,
                    borderRadius: 99,
                    background: 'linear-gradient(90deg, #D4AF37 0%, #C5A022 100%)',
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
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
      <Box sx={{ height: 'env(safe-area-inset-bottom, 0px)', bgcolor: 'rgba(255,255,255,0.88)' }} />
    </Paper>
  );
}
