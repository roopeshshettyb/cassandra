import React, { useEffect } from 'react';
import { Box } from '@mui/material';
import { motion } from 'framer-motion';
import useListControls from '../helper/useListControls';
import DataGrid from './DataGrid';
import ListControls from './ListControls';
import RequestCard from './cards/RequestCard';

import { PageHeader } from './cards/AppCards';

// No filter config lives here: /requests/filters serves it, built from the Request model.
function ManageRequests({ loading, setLoading, navigate, alertError, isMobile, account }) {
  const list = useListControls({ endpoint: '/requests', setLoading, alertError });

  // Auto-refresh when a new notification arrives (e.g. guest creates a request): filters intact,
  // no spinner.
  useEffect(() => {
    function onNewRequest() {
      list.refetch(true);
    }
    window.addEventListener('app:new_request', onNewRequest);
    return () => window.removeEventListener('app:new_request', onNewRequest);
  }, []);

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pb: 6, maxWidth: 1200, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader title="Requests" />
      </motion.div>
      <ListControls list={list} />
      <DataGrid CardComponent={RequestCard} data={list.data} isLoading={loading} navigate={navigate} account={account} />
    </Box>
  );
}

export default ManageRequests;
