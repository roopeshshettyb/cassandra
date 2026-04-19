import React, { useCallback, useState, useEffect } from 'react';
import { Box, Typography, Switch, Divider } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Circle, NotificationsNone, EmailOutlined } from '@mui/icons-material';
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

function PrefToggleRow({ icon: Icon, label, description, checked, onChange }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 1.5,
        px: 2,
        borderRadius: 2,
        bgcolor: checked ? 'rgba(212,175,55,0.06)' : 'transparent',
        border: `1px solid ${checked ? 'rgba(212,175,55,0.2)' : BORDER}`,
        transition: 'all 0.2s',
        flex: 1,
        minWidth: 160,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: checked ? BRAND_GRADIENT : 'transparent',
            border: checked ? 'none' : `1px solid ${BORDER}`,
            transition: 'all 0.2s',
            flexShrink: 0,
          }}
        >
          <Icon sx={{ fontSize: 16, color: checked ? '#fff' : MUTED }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: NAVY, lineHeight: 1.2 }}>{label}</Typography>
          {description && <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>{description}</Typography>}
        </Box>
      </Box>
      <Switch size="small" checked={!!checked} onChange={(e) => onChange(e.target.checked)} color="primary" />
    </Box>
  );
}

function PreferencesSection({ setLoading }) {
  const [preferences, setPreferences] = useState([]);

  useEffect(() => {
    request({
      endpoint: '/notifications/preferences',
      method: 'GET',
      setLoading,
      setData: setPreferences,
      defaultData: [],
    });
  }, []);

  const handleToggle = async (hotelId, field, value) => {
    setPreferences((prev) => {
      const next = [];
      for (let i = 0; i < prev.length; i++) {
        next.push(prev[i].hotelId === hotelId ? { ...prev[i], [field]: value } : prev[i]);
      }
      return next;
    });
    await request({
      endpoint: '/notifications/preferences',
      method: 'PATCH',
      body: { hotelId, [field]: value },
    });
  };

  if (preferences.length === 0) return null;

  return (
    <Box sx={{ mb: 5 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'primary.main', mb: 0.5 }}>Settings</Typography>
      <Typography sx={{ fontSize: 20, fontWeight: 700, color: NAVY, mb: 2 }}>Notification Preferences</Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {preferences.map((pref) => (
          <Box
            key={pref.hotelId}
            sx={{ bgcolor: 'background.paper', borderRadius: 3, overflow: 'hidden', border: `1px solid ${BORDER}`, boxShadow: SHADOW }}
          >
            <Box sx={{ px: 2.5, py: 1.5, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: BRAND_GRADIENT, flexShrink: 0 }} />
              <Typography sx={{ fontWeight: 700, fontSize: 13, color: NAVY }}>{pref.hotelName}</Typography>
            </Box>
            <Box sx={{ p: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <PrefToggleRow
                icon={NotificationsNone}
                label="Push"
                description="In-app alerts"
                checked={pref.pushEnabled}
                onChange={(v) => handleToggle(pref.hotelId, 'pushEnabled', v)}
              />
              <PrefToggleRow
                icon={EmailOutlined}
                label="Email"
                description="Send to inbox"
                checked={pref.emailEnabled}
                onChange={(v) => handleToggle(pref.hotelId, 'emailEnabled', v)}
              />
            </Box>
          </Box>
        ))}
      </Box>

      <Divider sx={{ mt: 4, mb: 4 }} />
    </Box>
  );
}

function Notifications({ notifications = [], notificationsLoading: loading = false, markNotificationAsRead, navigate, setLoading }) {
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

      <PreferencesSection setLoading={setLoading} />

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
