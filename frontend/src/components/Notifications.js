import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Circle } from '@mui/icons-material';
import request from '../helper/api';
import MapComponent from './MapComponent';

import { BRAND_GRADIENT, NAVY, MUTED, BORDER } from '../theme';

const typeColors = {
  DEAL_UPDATE: { color: '#2563EB', bg: 'rgba(37,99,235,0.1)' },
  PAYMENT: { color: '#059669', bg: 'rgba(5,150,105,0.1)' },
  SYSTEM: { color: '#888888', bg: 'rgba(136,136,136,0.1)' },
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
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          opacity: notification.read ? 0.6 : 1,
          '&:hover': { boxShadow: '0 6px 20px rgba(0,0,0,0.1)' },
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

function Notifications({ loading, setLoading, account, navigate, alertSuccess, alertError }) {
  const [notifications, setNotifications] = useState([]);

  const fetchNotifications = async () => {
    const data = await request({ endpoint: '/notifications', method: 'GET', setLoading, defaultData: [] });
    if (data) setNotifications(data);
  };

  useEffect(() => {
    if (account) fetchNotifications();
  }, [account]);

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await request({ endpoint: `/notifications/${notification.id}/read`, method: 'PATCH', setLoading, alertSuccess, alertError });
      await fetchNotifications();
    }
    if (notification.link && navigate) navigate(notification.link);
  };

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pt: 3, pb: 6, maxWidth: 800, mx: 'auto' }}>
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
