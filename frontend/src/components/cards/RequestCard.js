import React from 'react';
import { Card, CardContent, Typography, Box, Avatar, Stack, Chip } from '@mui/material';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

const RequestCard = ({ data, navigate, account }) => {
  const req = data;
  const hotelName = req.hotel?.name || '-';
  const guestName = req.guest?.name || req.guest?.email || 'Unknown Guest';
  const roomNumber = req.bookingId ? `#${req.bookingId}` : '-';

  const isGuest = account && account.role === 'guest';
  const sourceNotes = isGuest ? req.staffNotes : req.userNotes;

  const topNotes = sourceNotes
    ? sourceNotes
        .map((note) => (typeof note === 'string' ? note : note?.text))
        .filter(Boolean)
        .slice(0, 3)
    : [];

  const handleClick = () => {
    if (req && req.bookingId && navigate) {
      navigate(`/bookings/${req.bookingId}`);
    }
  };

  return (
    <Card
      onClick={handleClick}
      sx={{
        height: '100%',
        cursor: 'pointer',
        transition: 'transform 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4,
        },
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Avatar sx={{ bgcolor: 'secondary.main' }}>
            <PersonIcon />
          </Avatar>
          <Box sx={{ overflow: 'hidden' }}>
            <Typography variant="subtitle1" fontWeight="bold" noWrap>
              {guestName}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <BusinessIcon fontSize="inherit" color="action" />
              <Typography variant="caption" color="text.secondary" noWrap>
                {hotelName}
              </Typography>
            </Box>
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {req.createdAt ? dayjs(req.createdAt).fromNow() : ''}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} mb={2}>
          <Chip icon={<MeetingRoomIcon />} label={`Room ${roomNumber}`} size="small" color="primary" variant="outlined" />
        </Stack>

        <Box sx={{ bgcolor: 'action.hover', p: 1.5, borderRadius: 2 }}>
          <Typography variant="caption" color="text.primary" fontWeight="bold" display="block" mb={0.5}>
            Recent Notes:
          </Typography>
          {topNotes.length > 0 ? (
            <Stack spacing={0.5}>
              {topNotes.map((note, idx) => (
                <Typography key={idx} variant="body2" color="text.secondary" sx={{ display: 'flex', gap: 1 }}>
                  <span>•</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note}</span>
                </Typography>
              ))}
            </Stack>
          ) : (
            <Typography variant="caption" color="text.disabled" fontStyle="italic">
              No recent notes
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default RequestCard;
