import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Button, Card, CardContent, Container, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography, Grid } from '@mui/material';
import { motion } from 'framer-motion';
import Schedule from '@mui/icons-material/Schedule';
import request from '../helper/api';
import HotelInfoCard from './HotelInfoCard';
import ChatBox from './ChatBox';

const MotionBox = motion(Box);

function BookingDetails({ setLoading, account, navigate, alertSuccess, alertError }) {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const canDeleteBooking = account && (account.role === 'admin' || account.role === 'hotel_owner' || account.role === 'hotel_staff');

  useEffect(() => {
    if (id) {
      request({
        endpoint: `/bookings/${id}`,
        method: 'GET',
        setLoading,
        setData: setBooking,
        defaultData: null,
        alertError,
      });
    }
  }, []);

  const handleDeleteClick = () => setShowDeleteConfirm(true);
  const handleDeleteCancel = () => setShowDeleteConfirm(false);

  const handleDeleteConfirm = async () => {
    setShowDeleteConfirm(false);
    if (!id) return;
    const result = await request({
      endpoint: `/bookings/${id}`,
      method: 'DELETE',
      setLoading,
      alertSuccess,
      alertError,
    });
    if (result && result.success) {
      navigate('/bookings');
    }
  };

  if (!booking) {
    return null;
  }

  const startStr = booking.startTime ? new Date(booking.startTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-';
  const endStr = booking.endTime ? new Date(booking.endTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-';
  const bookingId = parseInt(id, 10);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <MotionBox initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <ChatBox bookingId={bookingId} alertError={alertError} />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="h4">Booking Details</Typography>
              {canDeleteBooking && (
                <Button variant="outlined" color="error" onClick={handleDeleteClick}>
                  Delete Booking
                </Button>
              )}
            </Box>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Schedule sx={{ color: 'text.secondary', fontSize: 20, mt: 0.25 }} />
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Check-in
                    </Typography>
                    <Typography variant="body2">{startStr}</Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Schedule sx={{ color: 'text.secondary', fontSize: 20, mt: 0.25 }} />
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Check-out
                    </Typography>
                    <Typography variant="body2">{endStr}</Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>

            {booking.hotel && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="h5" sx={{ mb: 2 }}>
                  Hotel
                </Typography>
                <HotelInfoCard hotel={booking.hotel} />
              </Box>
            )}
          </CardContent>
        </Card>

        <Dialog open={showDeleteConfirm} onClose={handleDeleteCancel} aria-labelledby="delete-booking-title" aria-describedby="delete-booking-description">
          <DialogTitle id="delete-booking-title">Delete booking</DialogTitle>
          <DialogContent>
            <DialogContentText id="delete-booking-description">Are you sure you want to delete this booking? This cannot be undone.</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDeleteCancel} color="primary" autoFocus>
              Cancel
            </Button>
            <Button onClick={handleDeleteConfirm} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </MotionBox>
    </Container>
  );
}

export default BookingDetails;
