import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Button, Card, CardContent, Container, Grid, TextField, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import request from '../helper/api';
import MapComponent from './MapComponent';

const MotionBox = motion(Box);

const hoursFieldConfigs = [
  { key: 'checkInTime', label: 'Check-in Time' },
  { key: 'checkOutTime', label: 'Check-out Time' },
  { key: 'poolHours', label: 'Pool Hours' },
  { key: 'gymHours', label: 'Gym Hours' },
  { key: 'restaurantHours', label: 'Restaurant Hours' },
  { key: 'wifiPassword', label: 'Wi-Fi Password' },
  { key: 'breakfastHours', label: 'Breakfast Hours' },
  { key: 'lunchHours', label: 'Lunch Hours' },
  { key: 'dinnerHours', label: 'Dinner Hours' },
  { key: 'snacksHours', label: 'Snacks Hours' },
  { key: 'houseKeepingHours', label: 'House Keeping Hours' },
  { key: 'roomServiceHours', label: 'Room Service Hours' },
];

const HoursEditField = ({ data, editValues, handleInputChange }) => {
  return (
    <Grid item xs={12} sm={6}>
      <TextField fullWidth label={data.label} value={editValues[data.key]} onChange={handleInputChange(data.key)} />
    </Grid>
  );
};

const HoursDisplayField = ({ data, hotel }) => {
  return (
    <Grid item xs={12} sm={6}>
      <Typography variant="subtitle2" color="text.secondary">
        {data.label}
      </Typography>
      <Typography variant="body2">{hotel[data.key] || '-'}</Typography>
    </Grid>
  );
};

function HotelDetails({ loading, setLoading, account, alertSuccess, alertError }) {
  const { id } = useParams();
  const [hotel, setHotel] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    name: '',
    address: '',
    checkInTime: '',
    checkOutTime: '',
    poolHours: '',
    gymHours: '',
    restaurantHours: '',
    wifiPassword: '',
    breakfastHours: '',
    lunchHours: '',
    dinnerHours: '',
    snacksHours: '',
    houseKeepingHours: '',
    roomServiceHours: '',
  });

  const fetchHotel = async () => {
    const data = await request({
      endpoint: `/hotels/${id}`,
      method: 'GET',
      setLoading,
      defaultData: null,
      alertError,
    });

    if (data) {
      setHotel(data);
      setEditValues({
        name: data.name || '',
        address: data.address || '',
        checkInTime: data.checkInTime || '',
        checkOutTime: data.checkOutTime || '',
        poolHours: data.poolHours || '',
        gymHours: data.gymHours || '',
        restaurantHours: data.restaurantHours || '',
        wifiPassword: data.wifiPassword || '',
        breakfastHours: data.breakfastHours || '',
        lunchHours: data.lunchHours || '',
        dinnerHours: data.dinnerHours || '',
        snacksHours: data.snacksHours || '',
        houseKeepingHours: data.houseKeepingHours || '',
        roomServiceHours: data.roomServiceHours || '',
      });
    }
  };

  useEffect(() => {
    if (id) {
      fetchHotel();
    }
  }, [id]);

  const canEdit = account && (account.role === 'admin' || account.role === 'hotel_owner' || account.role === 'hotel_staff');

  const handleInputChange = (field) => (event) => {
    setEditValues((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const payload = { ...editValues };

    const updated = await request({
      endpoint: `/hotels/${id}`,
      method: 'PATCH',
      data: payload,
      setLoading,
      alertSuccess,
      alertError,
    });

    if (updated) {
      setHotel(updated);
      setIsEditing(false);
    }
  };

  if (!hotel) {
    return;
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <MotionBox initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4">{hotel.name}</Typography>
              {canEdit && (
                <Button variant="contained" color="primary" onClick={() => setIsEditing((prev) => !prev)}>
                  {isEditing ? 'Cancel' : 'Edit'}
                </Button>
              )}
            </Box>

            {isEditing ? (
              <Box component="form" onSubmit={handleSave} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField fullWidth label="Name" value={editValues.name} onChange={handleInputChange('name')} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth label="Address" value={editValues.address} onChange={handleInputChange('address')} />
                  </Grid>
                  <MapComponent Component={HoursEditField} data={hoursFieldConfigs} editValues={editValues} handleInputChange={handleInputChange} showNoDataAvailable={false} isLoading={loading} />
                </Grid>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button type="submit" variant="contained" color="primary">
                    Save Changes
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="body1">{hotel.address}</Typography>
                <Grid container spacing={2}>
                  <MapComponent Component={HoursDisplayField} data={hoursFieldConfigs} hotel={hotel} showNoDataAvailable={false} isLoading={loading} />
                </Grid>
              </Box>
            )}
          </CardContent>
        </Card>
      </MotionBox>
    </Container>
  );
}

export default HotelDetails;
