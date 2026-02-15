import React from 'react';
import { Card, CardContent, Typography, Box, Chip } from '@mui/material';
import EventIcon from '@mui/icons-material/Event';
import HotelIcon from '@mui/icons-material/Hotel';

const BookingCard = ({ data, navigate }) => {
  const booking = data;
  const hotelName = booking.hotel?.name || 'Unknown Hotel';
  const startStr = booking.startTime ? new Date(booking.startTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-';
  const endStr = booking.endTime ? new Date(booking.endTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-';
  const status = booking.status || 'Active'; // Assuming a status field or defaulting to Active

  const handleClick = () => {
    if (booking && booking.id && navigate) {
      navigate(`/bookings/${booking.id}`);
    }
  };

  return (
    <Card
      onClick={handleClick}
      sx={{
        height: '100%',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 6,
        },
        position: 'relative',
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HotelIcon color="primary" />
            <Box>
              <Typography variant="h6" component="div" noWrap sx={{ maxWidth: 200 }}>
                {hotelName}
              </Typography>
              {booking.hotel?.address && (
                <Typography variant="caption" color="text.secondary" display="block" noWrap sx={{ maxWidth: 200 }}>
                  {booking.hotel.address}
                </Typography>
              )}
            </Box>
          </Box>
          <Chip label={status} color={status === 'Cancelled' ? 'error' : status === 'Completed' ? 'default' : 'success'} size="small" variant="outlined" />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EventIcon color="action" fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              Check-in:
            </Typography>
            <Typography variant="body2" fontWeight="medium">
              {startStr}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EventIcon color="action" fontSize="small" sx={{ opacity: 0 }} /> {/* Spacer */}
            <Typography variant="body2" color="text.secondary">
              Check-out:
            </Typography>
            <Typography variant="body2" fontWeight="medium">
              {endStr}
            </Typography>
          </Box>
        </Box>

        {booking.guestEmail && (
          <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">
              Guest: {booking.guestEmail}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default BookingCard;
