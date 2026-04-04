import React, { useCallback, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Circle } from '@mui/icons-material';
import MapComponent from './MapComponent';
import request from '../helper/api';

import { BRAND_GRADIENT, NAVY, MUTED, BORDER, SHADOW, SHADOW_HOVER, STATUS_INFO, STATUS_INFO_BG, STATUS_SUCCESS, STATUS_SUCCESS_BG, STATUS_WARNING, STATUS_WARNING_BG, TEXT_MUTED_DARK } from '../theme';

const typeColors = {
  DEAL_UPDATE: { color: STATUS_INFO, bg: STATUS_INFO_BG },
  PAYMENT: { color: STATUS_SUCCESS, bg: STATUS_SUCCESS_BG },
  NEW_REQUEST: { color: STATUS_INFO, bg: STATUS_INFO_BG },
  REQUEST_UPDATED: { color: STATUS_WARNING, bg: STATUS_WARNING_BG },
  NEW_BOOKING: { color: STATUS_SUCCESS, bg: STATUS_SUCCESS_BG },
  NEW_MESSAGE: { color: STATUS_INFO, bg: STATUS_INFO_BG },
  SYSTEM: { color: MUTED, bg: TEXT_MUTED_DARK },
};

function NotificationItem({ data: notification, onNotificationClick }) {
  const tc = typeColors[notification.type] || typeColors.SYSTEM;
  const label = notification.type?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.25 }}>
      <Box
        onClick={() => onNotificationClick(notification)}
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 3,
          p: 2.5,
          mb: 1.5,
          border: `1px solid ${BORDER}`,
          boxShadow: SHADOW,
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          opacity: notification.read ? 0.6 : 1,
          '@media (hover: hover)': { '&:hover': { boxShadow: SHADOW_HOVER } },
        }}
      >
        {/* Unread gold accent */}
        {!notification.read && <Box sx={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: BRAND_GRADIENT, borderRadius: '3px 0 0 3px' }} />}

        <Box sx={{ pl: notification.read ? 0 : 0.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, mr: 2 }}>
              {notification.read ? <CheckCircle sx={{ fontSize: 16, color: MUTED, flexShrink: 0 }} /> : <Circle sx={{ fontSize: 14, color: 'primary.main', flexShrink: 0 }} />}
              <Typography sx={{ fontWeight: 700, fontSize: 14, color: NAVY }}>{notification.title}</Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
              <Box sx={{ px: 1.5, py: 0.4, borderRadius: 99, bgcolor: tc.bg }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: tc.color }}>{label}</Typography>
              </Box>
              {notification.createdAt && <Typography sx={{ fontSize: 11, color: MUTED }}>{new Date(notification.createdAt).toLocaleDateString()}</Typography>}
            </Box>
          </Box>
          <Typography sx={{ fontSize: 13, color: MUTED, ml: notification.read ? 0 : 3.25, lineHeight: 1.55 }}>{notification.message}</Typography>
        </Box>
      </Box>
    </motion.div>
  );
}

function Notifications({ notifications = [], notificationsLoading: loading = false, markNotificationAsRead, navigate, alertSuccess, alertError }) {

  const handleNotificationClick = useCallback(async (notification) => {
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
    }
    if (notification.link && navigate) navigate(notification.link);
  }, [markNotificationAsRead, navigate]);

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pb: 6, maxWidth: 800, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'primary.main', mb: 0.5 }}>Inbox</Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 700, color: NAVY }}>Notifications</Typography>
          {notifications.length > 0 && <Typography sx={{ fontSize: 13, color: MUTED, mt: 0.5 }}>{notifications.filter((n) => !n.read).length} unread</Typography>}
        </Box>
      </motion.div>

      <AnimatePresence>
        <MapComponent Component={NotificationItem} data={notifications} onNotificationClick={handleNotificationClick} isLoading={loading} />
      </AnimatePresence>

      {!loading && notifications.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 10 }}>
          <Typography sx={{ color: MUTED, fontSize: 15, fontWeight: 500 }}>No notifications yet</Typography>
        </Box>
      )}
    </Box>
  );
}

export default Notifications;
