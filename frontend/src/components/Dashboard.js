import React, { useState, useEffect } from 'react';
import { Box, Container, Typography, Grid } from '@mui/material';
import { motion } from 'framer-motion';
import constants from '../constants.json';
import MapComponent from './MapComponent';
import CassandraAssistant from './CassandraAssistant';

const MotionBox = motion(Box);

const loginOptions = constants.PLATFORM_DATA_MAPPING?.general?.LOGIN_OPTIONS || [];

function Dashboard({ isMobile, sidebarOpen, account, openLoginPopup, loading, setLoading, smoothScrollToTop, navigate }) {
  const [sessionId] = useState(() => {
    const saved = sessionStorage.getItem('cassandra_session_id');
    if (saved) return saved;
    const newId = `session-${Date.now()}`;
    sessionStorage.setItem('cassandra_session_id', newId);
    return newId;
  });

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <MotionBox initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="h2" gutterBottom sx={{ fontWeight: 700, mb: 2 }}>
            Hi Guest!
          </Typography>
        </MotionBox>

        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <CassandraAssistant sessionId={sessionId} accountUuid={account?.uuid} />
        </Box>
      </Container>
    </Box>
  );
}

export default Dashboard;
