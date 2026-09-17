import React, { useEffect } from 'react';
import { Box } from '@mui/material';
import { motion } from 'framer-motion';
import useListControls from '../helper/useListControls';
import DataGrid from './DataGrid';
import ListControls from './ListControls';
import LoadMore from './LoadMore';
import RequestCard from './cards/RequestCard';
import { REQUEST_STATUS, REQUEST_URGENCY, REQUEST_TYPE_LABEL } from '../constants/requestConfig';
import { PageHeader } from './cards/AppCards';

const toOptions = (source) => Object.keys(source).map((value) => ({ value, label: source[value].label ?? source[value] }));

const filterConfigs = [
  { key: 'status', label: 'Status', multiple: true, options: toOptions(REQUEST_STATUS) },
  { key: 'urgency', label: 'Urgency', multiple: true, options: toOptions(REQUEST_URGENCY) },
  { key: 'requestType', label: 'Type', multiple: true, options: toOptions(REQUEST_TYPE_LABEL) },
];

const sortOptions = [
  { label: 'Newest first', value: { sortBy: 'createdAt', sortOrder: 'desc' } },
  { label: 'Oldest first', value: { sortBy: 'createdAt', sortOrder: 'asc' } },
  { label: 'Recently updated', value: { sortBy: 'updatedAt', sortOrder: 'desc' } },
  { label: 'Most urgent', value: { sortBy: 'urgency', sortOrder: 'desc' } },
];

function ManageRequests({ loading, setLoading, navigate, alertError, isMobile, account }) {
  const list = useListControls({
    endpoint: '/requests',
    setLoading,
    alertError,
    filterConfigs,
    sortOptions,
  });

  // Auto-refresh on a new request notification: filters and sort intact, no spinner.
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
      <ListControls
        filterConfigs={filterConfigs}
        sortOptions={sortOptions}
        filters={list.filters}
        sort={list.sort}
        total={list.total}
        onFilterChange={list.onFilterChange}
        onSortChange={list.onSortChange}
      />
      <DataGrid CardComponent={RequestCard} data={list.data} isLoading={loading} navigate={navigate} account={account} />
      <LoadMore hasMore={list.hasMore} onLoadMore={list.loadMore} loaded={list.data.length} total={list.total} />
    </Box>
  );
}

export default ManageRequests;
