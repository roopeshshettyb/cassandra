import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import request from '../helper/api';
import DataGrid from './DataGrid';
import RequestCard from './cards/RequestCard';

import { NAVY } from '../theme';
import { PageHeader } from './cards/AppCards';

function ManageRequests({ loading, setLoading, navigate, alertError, isMobile, account }) {
  const [requests, setRequests] = useState([]);

  function fetchRequests(isBackground) {
    request({
      endpoint: '/requests',
      method: 'GET',
      setLoading: isBackground ? null : setLoading,
      setData: setRequests,
      defaultData: [],
      alertError,
      delay: false,
    });
  }

  // Initial load
  useEffect(() => {
    fetchRequests(false);
  }, []);

  // Auto-refresh when a new notification arrives (e.g. guest creates a request)
  useEffect(() => {
    function onNewRequest() {
      fetchRequests(true); // background refresh, no spinner
    }
    window.addEventListener('app:new_request', onNewRequest);
    return () => window.removeEventListener('app:new_request', onNewRequest);
  }, []);

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pb: 6, maxWidth: 1200, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader title="Requests" />
      </motion.div>
      <DataGrid CardComponent={RequestCard} data={requests} isLoading={loading} navigate={navigate} account={account} />
    </Box>
  );
}

export default ManageRequests;
