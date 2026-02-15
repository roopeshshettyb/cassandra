import React, { useEffect, useState } from 'react';
import { Box, Container } from '@mui/material';
import { motion } from 'framer-motion';
import request from '../helper/api';
import DataGrid from './DataGrid';
import RequestCard from './cards/RequestCard';

const MotionBox = motion(Box);

// ... (MotionBox definition)

// Removed NoteText and RequestRow

function ManageRequests({ loading, setLoading, navigate, alertError, isMobile, account }) {
  const [requests, setRequests] = useState([]);

  const fetchRequests = async () => {
    await request({
      endpoint: '/requests',
      method: 'GET',
      setLoading,
      setData: setRequests,
      defaultData: [],
      alertError,
    });
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // requestColumns removed

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <MotionBox initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: isMobile ? 'flex-start' : 'flex-end',
              alignItems: isMobile ? 'flex-end' : 'center',
              gap: 2,
            }}
          />

          <Box>
            <DataGrid CardComponent={RequestCard} data={requests} isLoading={loading} navigate={navigate} account={account} />
          </Box>
        </Box>
      </MotionBox>
    </Container>
  );
}

export default ManageRequests;
