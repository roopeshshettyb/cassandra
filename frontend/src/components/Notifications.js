import React, { useState, useEffect } from 'react';
import { Box, Container, Typography, Card, CardContent, Chip, IconButton } from '@mui/material';
import { motion } from 'framer-motion';
import { CheckCircle, Circle } from '@mui/icons-material';
import request from '../helper/api';
import MapComponent from './MapComponent';

const MotionBox = motion(Box);

function Notifications({ loading, setLoading, account, navigate, alertSuccess, alertError }) {
  const [notifications, setNotifications] = useState([]);

  const fetchNotifications = async () => {
    const data = await request({
      endpoint: '/notifications',
      method: 'GET',
      setLoading,
      defaultData: [],
    });
    if (data) {
      setNotifications(data || []);
    }
  };

  useEffect(() => {
    if (account) {
      fetchNotifications();
    }
  }, [account]);

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await request({
        endpoint: `/notifications/${notification.id}/read`,
        method: 'PATCH',
        setLoading,
        alertSuccess,
        alertError,
      });
      await fetchNotifications();
    }
    if (notification.link && navigate) {
      navigate(notification.link);
    }
  };

  const getTypeColor = (type) => {
    const typeColors = {
      DEAL_UPDATE: 'info',
      PAYMENT: 'success',
      SYSTEM: 'default',
    };
    return typeColors[type] || 'default';
  };

  const formatType = (type) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const NotificationItem = ({ data, onNotificationClick }) => {
    const notification = data;
    return (
      <Card
        onClick={() => onNotificationClick(notification)}
        sx={{
          mb: 2,
          opacity: notification.read ? 0.7 : 1,
          borderLeft: notification.read ? 'none' : '4px solid',
          borderColor: 'primary.main',
          cursor: 'pointer',
          '&:hover': {
            boxShadow: 4,
          },
        }}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                {notification.read ? <CheckCircle sx={{ fontSize: 16, color: 'text.secondary' }} /> : <Circle sx={{ fontSize: 16, color: 'primary.main' }} />}
                <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                  {notification.title}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ ml: 3 }}>
                {notification.message}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
              <Chip label={formatType(notification.type)} color={getTypeColor(notification.type)} size="small" />
              {notification.createdAt && (
                <Typography variant="caption" color="text.secondary">
                  {new Date(notification.createdAt).toLocaleDateString()}
                </Typography>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <MotionBox initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <Box>
          <MapComponent Component={NotificationItem} data={notifications} onNotificationClick={handleNotificationClick} isLoading={loading} />
        </Box>
      </MotionBox>
    </Container>
  );
}

export default Notifications;
