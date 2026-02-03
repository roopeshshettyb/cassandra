import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Card, CardContent, Container, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import request from '../helper/api';
import HotelInfoCard from './HotelInfoCard';

const MotionBox = motion(Box);

function BookingDetails({ setLoading, alertError }) {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);

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

  if (!booking) {
    return null;
  }

  const startStr = booking.startTime ? new Date(booking.startTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-';
  const endStr = booking.endTime ? new Date(booking.endTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-';

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <MotionBox initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card>
          <CardContent>
            <Typography variant="h4" sx={{ mb: 3 }}>
              Booking Details
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Check-in
              </Typography>
              <Typography variant="body1">{startStr}</Typography>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
                Check-out
              </Typography>
              <Typography variant="body1">{endStr}</Typography>
            </Box>

            {booking.hotel && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Hotel
                </Typography>
                <HotelInfoCard hotel={booking.hotel} />
              </Box>
            )}
          </CardContent>
        </Card>
      </MotionBox>
    </Container>
  );
}

export default BookingDetails;
