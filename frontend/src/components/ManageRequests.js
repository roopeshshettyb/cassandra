import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import request from '../helper/api';
import DataGrid from './DataGrid';
import RequestCard from './cards/RequestCard';

import { NAVY } from '../theme';

function ManageRequests({ loading, setLoading, navigate, alertError, isMobile, account }) {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    request({ endpoint: '/requests', method: 'GET', setLoading, setData: setRequests, defaultData: [], alertError });
  }, []);

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pt: 3, pb: 6, maxWidth: 1200, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'primary.main', mb: 0.5 }}>
            Management
          </Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 700, color: NAVY }}>Requests</Typography>
        </Box>
      </motion.div>
      <DataGrid CardComponent={RequestCard} data={requests} isLoading={loading} navigate={navigate} account={account} />
    </Box>
  );
}

export default ManageRequests;
