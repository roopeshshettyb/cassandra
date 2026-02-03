import React, { useEffect, useState } from 'react';
import { Box, Button, Container, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TableCell, TableRow, TextField, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import DataTable from './DataTable';
import request from '../helper/api';

const MotionBox = motion(Box);

const BookingRow = ({ data, navigate }) => {
  const booking = data;
  const hotelName = booking.hotel?.name || '-';
  const startStr = booking.startTime ? new Date(booking.startTime).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '-';
  const endStr = booking.endTime ? new Date(booking.endTime).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '-';

  const handleClick = () => {
    if (booking && booking.id) {
      navigate(`/bookings/${booking.id}`);
    }
  };

  return (
    <TableRow hover onClick={handleClick} sx={{ cursor: 'pointer' }}>
      <TableCell>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {hotelName}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {startStr}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {endStr}
        </Typography>
      </TableCell>
    </TableRow>
  );
};

function ManageBookings({ loading, setLoading, account, navigate, alertSuccess, alertError, isMobile }) {
  const [bookings, setBookings] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createValues, setCreateValues] = useState({
    startDate: '',
    endDate: '',
    guestEmail: '',
    hotelId: '',
  });

  const fetchBookings = async () => {
    await request({
      endpoint: '/bookings',
      method: 'GET',
      setLoading,
      setData: setBookings,
      defaultData: [],
      alertError,
    });
  };

  const fetchHotels = async () => {
    const res = await request({
      endpoint: '/hotels',
      method: 'GET',
      defaultData: [],
      alertError,
    });
    if (res && Array.isArray(res)) {
      setHotels(res);
    }
  };

  useEffect(() => {
    fetchBookings();
    if (account && (account.role === 'admin' || account.role === 'hotel_owner' || account.role === 'hotel_staff')) {
      fetchHotels();
    }
  }, []);

  const canCreateBooking = account && (account.role === 'admin' || account.role === 'hotel_owner' || account.role === 'hotel_staff');

  const handleCreateInput = (field) => (e) => {
    setCreateValues((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    const { startDate, endDate, guestEmail, hotelId } = createValues;
    if (!startDate || !endDate || !guestEmail || !hotelId) {
      alertError && alertError('Start date, end date, guest email and hotel are required');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      alertError && alertError('End date must be on or after start date');
      return;
    }
    const result = await request({
      endpoint: '/bookings',
      method: 'POST',
      data: { startDate, endDate, guestEmail, hotelId: Number(hotelId) },
      setLoading,
      alertSuccess,
      alertError,
    });
    if (result && result.success) {
      setCreateValues({ startDate: '', endDate: '', guestEmail: '', hotelId: '' });
      setShowCreateDialog(false);
      fetchBookings();
    }
  };

  const bookingColumns = [
    { key: 'hotel', label: 'Hotel' },
    { key: 'start', label: 'Start' },
    { key: 'end', label: 'End' },
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
          >
            {canCreateBooking && (
              <Button variant="contained" color="primary" onClick={() => setShowCreateDialog(true)}>
                Create Booking
              </Button>
            )}
          </Box>

          <Dialog open={showCreateDialog && canCreateBooking} onClose={() => setShowCreateDialog(false)} fullWidth maxWidth="sm">
            <DialogTitle>Create Booking</DialogTitle>
            <Box component="form" onSubmit={handleCreateBooking}>
              <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                  <TextField fullWidth label="Start Date" type="date" value={createValues.startDate} onChange={handleCreateInput('startDate')} InputLabelProps={{ shrink: true }} />
                  <TextField fullWidth label="End Date" type="date" value={createValues.endDate} onChange={handleCreateInput('endDate')} InputLabelProps={{ shrink: true }} />
                  <TextField fullWidth label="Guest Email" type="email" value={createValues.guestEmail} onChange={handleCreateInput('guestEmail')} required />
                  <TextField
                    fullWidth
                    select
                    label="Hotel"
                    value={createValues.hotelId}
                    onChange={handleCreateInput('hotelId')}
                    required
                    SelectProps={{
                      displayEmpty: true,
                      renderValue: (v) => {
                        if (v === '') return 'Select hotel';
                        const h = hotels.find((x) => String(x.id) === String(v));
                        return h ? h.name : 'Select hotel';
                      },
                      MenuProps: { sx: { zIndex: 1400 } },
                    }}
                    InputLabelProps={{ shrink: true }}
                  >
                    {hotels.map((h) => (
                      <MenuItem key={h.id} value={String(h.id)}>
                        {h.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                <Button type="submit" variant="contained" color="primary">
                  Create Booking
                </Button>
              </DialogActions>
            </Box>
          </Dialog>

          <Box>
            <DataTable columns={bookingColumns} RowComponent={BookingRow} data={bookings} isLoading={loading} navigate={navigate} />
          </Box>
        </Box>
      </MotionBox>
    </Container>
  );
}

export default ManageBookings;
