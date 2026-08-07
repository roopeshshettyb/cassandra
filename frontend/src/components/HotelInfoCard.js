import React from 'react';
import { Box, Grid, Typography } from '@mui/material';
import Schedule from '@mui/icons-material/Schedule';
import Pool from '@mui/icons-material/Pool';
import FitnessCenter from '@mui/icons-material/FitnessCenter';
import Restaurant from '@mui/icons-material/Restaurant';
import Wifi from '@mui/icons-material/Wifi';
import BreakfastDining from '@mui/icons-material/BreakfastDining';
import LunchDining from '@mui/icons-material/LunchDining';
import DinnerDining from '@mui/icons-material/DinnerDining';
import Cookie from '@mui/icons-material/Cookie';
import CleaningServices from '@mui/icons-material/CleaningServices';
import RoomService from '@mui/icons-material/RoomService';

const FIELD_CONFIG = [
  { key: 'checkInTime', label: 'Check-in Time', Icon: Schedule },
  { key: 'checkOutTime', label: 'Check-out Time', Icon: Schedule },
  { key: 'poolHours', label: 'Pool Hours', Icon: Pool },
  { key: 'gymHours', label: 'Gym Hours', Icon: FitnessCenter },
  { key: 'restaurantHours', label: 'Restaurant Hours', Icon: Restaurant },
  { key: 'wifiPassword', label: 'Wi-Fi Password', Icon: Wifi },
  { key: 'breakfastHours', label: 'Breakfast Hours', Icon: BreakfastDining },
  { key: 'lunchHours', label: 'Lunch Hours', Icon: LunchDining },
  { key: 'dinnerHours', label: 'Dinner Hours', Icon: DinnerDining },
  { key: 'snacksHours', label: 'Snacks Hours', Icon: Cookie },
  { key: 'houseKeepingHours', label: 'House Keeping Hours', Icon: CleaningServices },
  { key: 'roomServiceHours', label: 'Room Service Hours', Icon: RoomService },
];

function HotelInfoCard({ hotel, loading }) {
  if (!hotel) {
    return null;
  }

  const fieldsWithData = FIELD_CONFIG.filter((c) => hotel[c.key]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {hotel.name && (
        <Typography variant="h6" color="text.primary">
          {hotel.name}
        </Typography>
      )}
      {hotel.address && (
        <Typography variant="body1" color="text.primary">
          {hotel.address}
        </Typography>
      )}
      <Grid container spacing={2}>
        {fieldsWithData.map(({ key, label, Icon }) => (
          <Grid item xs={12} sm={6} key={key}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Icon sx={{ color: 'text.secondary', fontSize: 20, mt: 0.25 }} />
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  {label}
                </Typography>
                <Typography variant="body2">{hotel[key]}</Typography>
              </Box>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export default HotelInfoCard;
