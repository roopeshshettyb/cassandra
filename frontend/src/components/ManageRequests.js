import React, { useEffect, useState } from 'react';
import { Box, Container, TableCell, TableRow, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import DataTable from './DataTable';
import MapComponent from './MapComponent';
import request from '../helper/api';

const MotionBox = motion(Box);

const NoteText = ({ data }) => (
  <Typography
    variant="body2"
    color="text.secondary"
    sx={{ maxWidth: 260, display: 'block' }}
  >
    • {data}
  </Typography>
);

const RequestRow = ({ data, navigate, account }) => {
  const req = data;
  const hotelName = req.hotel?.name || '-';
  const guestName = req.guest?.name || req.guest?.email || '-';

  const roomNumber = req.bookingId ? `#${req.bookingId}` : '-';

  const isGuest = account && account.role === 'guest';
  const sourceNotes = isGuest ? req.staffNotes : req.userNotes;

  const topNotes = sourceNotes
    .map((note) => (typeof note === 'string' ? note : note?.text))
    .filter(Boolean)
    .slice(0, 3);

  const handleClick = () => {
    if (req && req.bookingId) {
      navigate(`/bookings/${req.bookingId}`);
    }
  };

  return (
    <TableRow hover onClick={handleClick} sx={{ cursor: 'pointer' }}>
      <TableCell>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {guestName}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {roomNumber}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {hotelName}
        </Typography>
      </TableCell>
      <TableCell>
        <MapComponent Component={NoteText} data={topNotes} showNoDataAvailable={false} />
      </TableCell>
    </TableRow>
  );
};

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

  const requestColumns = [
    { key: 'guest', label: 'Guest' },
    { key: 'room', label: 'Room' },
    { key: 'hotel', label: 'Hotel' },
    { key: 'notes', label: 'Top Notes' },
  ];

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
            <DataTable columns={requestColumns} RowComponent={RequestRow} data={requests} isLoading={loading} navigate={navigate} account={account} />
          </Box>
        </Box>
      </MotionBox>
    </Container>
  );
}

export default ManageRequests;

