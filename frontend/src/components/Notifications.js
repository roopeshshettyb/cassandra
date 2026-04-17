import React, { useCallback } from 'react';
import { Box, Typography, Switch } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Circle, NotificationsActive, Email } from '@mui/icons-material';
import MapComponent from './MapComponent';

import { BRAND_GRADIENT, NAVY, MUTED, BORDER, SHADOW, SHADOW_HOVER, STATUS_INFO, STATUS_INFO_BG, STATUS_SUCCESS, STATUS_SUCCESS_BG, TEXT_MUTED_DARK } from '../theme';

const typeColors = {
  DEAL_UPDATE: { color: STATUS_INFO, bg: STATUS_INFO_BG },
  PAYMENT: { color: STATUS_SUCCESS, bg: STATUS_SUCCESS_BG },
  SYSTEM: { color: MUTED, bg: TEXT_MUTED_DARK }, // Or HOVER_BG / TEXT_MUTED_DARK etc
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
          '&:hover': { boxShadow: SHADOW_HOVER },
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

const PREF_ITEMS = [
  {
    key: 'push',
    Icon: NotificationsActive,
    label: 'Push Notifications',
    description: 'Real-time alerts inside the app',
  },
  {
    key: 'email',
    Icon: Email,
    label: 'Email Notifications',
    description: 'Receive updates via email',
  },
];

function Notifications({ notifications = [], notificationsLoading: loading = false, markNotificationAsRead, navigate, notificationPreferences = { push: true, email: true }, updateNotificationPreferences }) {

  const handleNotificationClick = useCallback(async (notification) => {
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
    }
    if (notification.link && navigate) navigate(notification.link);
  }, [markNotificationAsRead, navigate]);

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pt: 3, pb: 6, maxWidth: 800, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'primary.main', mb: 0.5 }}>Inbox</Typography>
            <Typography sx={{ fontSize: 26, fontWeight: 700, color: NAVY }}>Notifications</Typography>
            {notifications.length > 0 && <Typography sx={{ fontSize: 13, color: MUTED, mt: 0.5 }}>{notifications.filter((n) => !n.read).length} unread</Typography>}
          </Box>
        </Box>
      </motion.div>

      {/* Preference toggles */}
      <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {PREF_ITEMS.map(({ key, Icon, label, description }) => (
          <Box
            key={key}
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, borderRadius: 3, bgcolor: 'background.paper', border: `1px solid ${BORDER}`, boxShadow: SHADOW }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Icon sx={{ fontSize: 22, color: 'primary.main' }} />
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{label}</Typography>
                <Typography sx={{ fontSize: 12, color: MUTED }}>{description}</Typography>
              </Box>
            </Box>
            <Switch
              size="small"
              checked={!!notificationPreferences[key]}
              onChange={(e) => updateNotificationPreferences?.({ [key]: e.target.checked })}
              color="primary"
            />
          </Box>
        ))}
      </Box>

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
