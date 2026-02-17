import React from 'react';
import { Card, CardContent, Typography, Box, Chip, Divider, Stack } from '@mui/material';
import EventIcon from '@mui/icons-material/Event';
import HotelIcon from '@mui/icons-material/Hotel';
import PersonIcon from '@mui/icons-material/Person';
import NumbersIcon from '@mui/icons-material/Numbers';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

const BookingCard = ({ data, navigate, pendingRequestsCount }) => {
  const booking = data;
  const hotelName = booking.hotel?.name || 'Unknown Hotel';
  const start = booking.startTime ? new Date(booking.startTime) : null;
  const end = booking.endTime ? new Date(booking.endTime) : null;

  const startStr = start ? start.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-';
  const endStr = end ? end.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-';
  const status = booking.status || (booking.isWithinStay ? 'Active' : 'Upcoming');

  // Calculate Duration
  let durationStr = '';
  if (start && end) {
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    durationStr = `${diffDays} Night${diffDays !== 1 ? 's' : ''}`;
  }

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
        borderRadius: 3,
      }}
    >
      <CardContent>
        {/* Header: Hotel Name & Status */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HotelIcon color="primary" />
            <Box>
              <Typography variant="h6" component="div" noWrap sx={{ maxWidth: 180, fontWeight: 'bold' }}>
                {hotelName}
              </Typography>
              {booking.hotel?.address && (
                <Typography variant="caption" color="text.secondary" display="block" noWrap sx={{ maxWidth: 180 }}>
                  {booking.hotel.address}
                </Typography>
              )}
            </Box>
          </Box>
          <Chip label={status} color={status === 'Cancelled' ? 'error' : status === 'Active' ? 'success' : 'default'} size="small" variant={status === 'Active' ? 'filled' : 'outlined'} />
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Details Grid */}
        <Stack spacing={1.5}>
          {/* Guest Name (if available) */}
          {booking.guest && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon color="action" fontSize="small" />
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 70 }}>
                Guest:
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {booking.guest.name || booking.guest.email}
              </Typography>
            </Box>
          )}

          {/* Booking ID */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NumbersIcon color="action" fontSize="small" />
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 70 }}>
              Ref ID:
            </Typography>
            <Typography variant="body2" fontWeight="medium" sx={{ fontFamily: 'monospace' }}>
              #{booking.id}
            </Typography>
          </Box>

          {/* Check-in */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EventIcon color="action" fontSize="small" />
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 70 }}>
              Check-in:
            </Typography>
            <Typography variant="body2" fontWeight="medium">
              {startStr}
            </Typography>
          </Box>

          {/* Duration */}
          {durationStr && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTimeIcon color="action" fontSize="small" />
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 70 }}>
                Duration:
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {durationStr}
              </Typography>
            </Box>
          )}
        </Stack>

        {/* Footer: Pending Requests Count */}
        {pendingRequestsCount !== undefined && pendingRequestsCount > 0 && (
          <Box sx={{ mt: 2, pt: 1, borderTop: 1, borderColor: 'divider' }}>
            <Chip label={`${pendingRequestsCount} Pending Request${pendingRequestsCount !== 1 ? 's' : ''}`} color="warning" size="small" sx={{ width: '100%', fontWeight: 'bold' }} />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default BookingCard;
