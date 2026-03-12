import React, { useEffect, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import request from '../helper/api';
import DataGrid from './DataGrid';
import BookingCard from './cards/BookingCard';

import { GOLD_GRADIENT, NAVY, MUTED } from '../theme';

function ManageBookings({ loading, setLoading, account, navigate, alertSuccess, alertError, isMobile }) {
  const [bookings, setBookings] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createValues, setCreateValues] = useState({ startDate: '', endDate: '', guestEmail: '', hotelId: '' });
  const [dataLoading, setDataLoading] = useState(true);

  const fetchBookings = async () => {
    await request({ endpoint: '/bookings', method: 'GET', setLoading: setDataLoading, setData: setBookings, defaultData: [], alertError });
  };

  const fetchHotels = async () => {
    await request({ endpoint: '/hotels', method: 'GET', defaultData: [], alertError, setData: setHotels });
  };

  useEffect(() => {
    fetchBookings();
    if (account && (account.role === 'admin' || account.role === 'hotel_owner' || account.role === 'hotel_staff')) {
      fetchHotels();
    }
  }, []);

  const canCreateBooking = account && (account.role === 'admin' || account.role === 'hotel_owner' || account.role === 'hotel_staff');
  const handleCreateInput = (field) => (e) => setCreateValues((prev) => ({ ...prev, [field]: e.target.value }));

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    const { startDate, endDate, guestEmail, hotelId } = createValues;
    if (!startDate || !endDate || !guestEmail || !hotelId) {
      alertError?.('All fields are required');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      alertError?.('End date must be after start date');
      return;
    }
    const result = await request({ endpoint: '/bookings', method: 'POST', data: { startDate, endDate, guestEmail, hotelId: Number(hotelId) }, setLoading, alertSuccess, alertError });
    if (result?.success) {
      setCreateValues({ startDate: '', endDate: '', guestEmail: '', hotelId: '' });
      setShowCreateDialog(false);
      fetchBookings();
    }
  };

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pt: { xs: '4vh', sm: 1.5 }, pb: 6, maxWidth: 1200, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: { xs: 'flex-end', sm: 'space-between' }, mb: 2.5, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'primary.main', mb: 0.5 }}>Management</Typography>
            <Typography sx={{ fontSize: 26, fontWeight: 700, color: NAVY }}>Bookings</Typography>
          </Box>
          {canCreateBooking && (
            <motion.button
              onClick={() => setShowCreateDialog(true)}
              whileTap={{ scale: 0.97 }}
              style={{
                background: GOLD_GRADIENT,
                border: 'none',
                borderRadius: 10,
                padding: '10px 22px',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(197,160,34,0.3)',
              }}
            >
              + New Booking
            </motion.button>
          )}
        </Box>
      </motion.div>

      <Dialog open={showCreateDialog && canCreateBooking} onClose={() => setShowCreateDialog(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, color: NAVY }}>New Booking</DialogTitle>
        <Box component="form" onSubmit={handleCreateBooking}>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              {[
                { field: 'startDate', label: 'Start Date', type: 'date' },
                { field: 'endDate', label: 'End Date', type: 'date' },
                { field: 'guestEmail', label: 'Guest Email', type: 'email', required: true },
              ].map(({ field, label, type, required }) => (
                <TextField key={field} fullWidth label={label} type={type} value={createValues[field]} onChange={handleCreateInput(field)} InputLabelProps={{ shrink: true }} required={required} />
              ))}
              <TextField
                fullWidth
                select
                label="Hotel"
                value={createValues.hotelId}
                onChange={handleCreateInput('hotelId')}
                required
                SelectProps={{
                  displayEmpty: true,
                  renderValue: (v) => (v === '' ? 'Select hotel' : hotels.find((x) => String(x.id) === String(v))?.name || 'Select hotel'),
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
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setShowCreateDialog(false)} sx={{ color: MUTED }}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="primary">
              Create Booking
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <DataGrid CardComponent={BookingCard} data={bookings} isLoading={dataLoading} navigate={navigate} />
    </Box>
  );
}

export default ManageBookings;
