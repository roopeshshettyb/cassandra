import React from 'react';
import { Card, CardContent, Typography, Box, CardMedia, CardActions, Button } from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import HotelIcon from '@mui/icons-material/Hotel';

const HotelCard = ({ data, navigate }) => {
  const hotel = data;

  const handleClick = () => {
    if (hotel && hotel.id && navigate) {
      navigate(`/hotels/${hotel.id}`);
    }
  };

  // Placeholder image logic using theme primary color as background if no image
  const placeholderColor = '#f5f5f5';

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4,
        },
      }}
    >
      <Box
        sx={{
          height: 140,
          bgcolor: 'primary.light',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'primary.contrastText',
        }}
      >
        <HotelIcon sx={{ fontSize: 60, opacity: 0.8 }} />
      </Box>

      <CardContent sx={{ flexGrow: 1 }}>
        <Typography gutterBottom variant="h5" component="div" fontWeight="bold">
          {hotel.name}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
          <LocationOnIcon color="action" fontSize="small" sx={{ mt: 0.3 }} />
          <Typography variant="body2" color="text.secondary">
            {hotel.address}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
          <AccessTimeIcon color="action" fontSize="small" />
          <Typography variant="caption" color="text.secondary">
            Check-in: <strong>{hotel.checkInTime || '-'}</strong> / Out: <strong>{hotel.checkOutTime || '-'}</strong>
          </Typography>
        </Box>
      </CardContent>

      <CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
        <Button size="small" variant="contained" onClick={handleClick}>
          Manage Hotel
        </Button>
      </CardActions>
    </Card>
  );
};

export default HotelCard;
