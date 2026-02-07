import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Button, Card, CardContent, Container, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Grid, TableCell, TableRow, TextField, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import request from '../helper/api';
import MapComponent from './MapComponent';
import DataTable from './DataTable';
import HotelInfoCard from './HotelInfoCard';
import ManageRestaurant from './ManageRestaurant';

const MotionBox = motion(Box);

const hoursFieldConfigs = [
  { key: 'checkInTime', label: 'Check-in Time', type: 'time' },
  { key: 'checkOutTime', label: 'Check-out Time', type: 'time' },
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
      <TextField
        fullWidth
        label={data.label}
        type={data.type || 'text'}
        value={editValues[data.key] || ''}
        onChange={handleInputChange(data.key)}
        inputProps={data.type === 'time' ? { step: 60 } : undefined}
      />
    </Grid>
  );
};

const StaffRow = ({ data, canManageStaff, onRevoke }) => {
  const staff = data;
  const handleRevoke = (e) => {
    e.stopPropagation();
    if (onRevoke && staff.id) onRevoke(staff.id);
  };
  return (
    <TableRow>
      <TableCell>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {staff.name || '-'}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {staff.email || '-'}
        </Typography>
      </TableCell>
      <TableCell>
        {canManageStaff && (
          <Button size="small" color="secondary" variant="outlined" onClick={handleRevoke}>
            Revoke
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
};

function HotelDetails({ loading, setLoading, account, navigate, alertSuccess, alertError, isLoading, isMobile }) {
  const { id } = useParams();
  const [hotel, setHotel] = useState(null);
  const [staff, setStaff] = useState([]);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteHotelConfirm, setShowDeleteHotelConfirm] = useState(false);
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

  const canManageStaff = account && (account.role === 'admin' || account.role === 'hotel_owner');

  const fetchStaff = async () => {
    if (!id || !canManageStaff) return;
    await request({
      endpoint: `/hotels/${id}/staff`,
      method: 'GET',
      setLoading: setLoading,
      setData: setStaff,
      defaultData: [],
      alertError,
    });
  };

  useEffect(() => {
    if (id) fetchHotel();
    if (canManageStaff) fetchStaff();
  }, [id]);

  const canEdit = account && (account.role === 'admin' || account.role === 'hotel_owner' || account.role === 'hotel_staff');
  const canDeleteHotel = account && account.role === 'admin';

  const handleAddStaff = async (e) => {
    e.preventDefault();
    const email = (newStaffEmail || '').trim();
    if (!email) {
      alertError && alertError('Email is required');
      return;
    }
    const result = await request({
      endpoint: `/hotels/${id}/staff`,
      method: 'POST',
      data: { email },
      setLoading,
      alertSuccess,
      alertError,
    });
    if (result && result.success) {
      setNewStaffEmail('');
      fetchStaff();
    }
  };

  const handleRevokeStaff = async (accountId) => {
    const ok = await request({
      endpoint: `/hotels/${id}/staff/${accountId}`,
      method: 'DELETE',
      setLoading,
      alertSuccess,
      alertError,
    });
    if (ok && ok.success) {
      fetchStaff();
    }
  };

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

  const handleDeleteHotelClick = () => setShowDeleteHotelConfirm(true);
  const handleDeleteHotelCancel = () => setShowDeleteHotelConfirm(false);

  const handleDeleteHotelConfirm = async () => {
    setShowDeleteHotelConfirm(false);
    if (!id) return;
    const result = await request({
      endpoint: `/hotels/${id}`,
      method: 'DELETE',
      setLoading,
      alertSuccess,
      alertError,
    });
    if (result && result.success) {
      navigate('/hotels');
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
              <Typography variant="h4">Hotel</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {canEdit && (
                  <Button variant="contained" color="primary" onClick={() => setIsEditing((prev) => !prev)}>
                    {isEditing ? 'Cancel' : 'Edit'}
                  </Button>
                )}
                {canDeleteHotel && (
                  <Button variant="outlined" color="error" onClick={handleDeleteHotelClick}>
                    Delete Hotel
                  </Button>
                )}
              </Box>
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
              <HotelInfoCard hotel={hotel} loading={loading} />
            )}

            {canManageStaff && (
              <Box sx={{ mt: 4 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Hotel Staff
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Add staff by email. They will receive an email to log in.
                </Typography>
                <Box component="form" onSubmit={handleAddStaff} sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
                  <TextField size="small" label="Staff email" type="email" value={newStaffEmail} onChange={(e) => setNewStaffEmail(e.target.value)} sx={{ minWidth: 240 }} />
                  <Button type="submit" variant="contained" color="primary" size="medium">
                    Add Staff
                  </Button>
                </Box>
                <DataTable
                  columns={[
                    { key: 'name', label: 'Name' },
                    { key: 'email', label: 'Email' },
                    { key: 'actions', label: 'Actions' },
                  ]}
                  RowComponent={StaffRow}
                  data={staff}
                  isLoading={isLoading}
                  canManageStaff={canManageStaff}
                  onRevoke={handleRevokeStaff}
                />
              </Box>
            )}

            {canEdit && (
              <ManageRestaurant
                hotelId={id}
                loading={loading}
                setLoading={setLoading}
                account={account}
                alertSuccess={alertSuccess}
                alertError={alertError}
                isMobile={isMobile}
              />
            )}

            <Dialog open={showDeleteHotelConfirm} onClose={handleDeleteHotelCancel} aria-labelledby="delete-hotel-title" aria-describedby="delete-hotel-description">
              <DialogTitle id="delete-hotel-title">Delete hotel</DialogTitle>
              <DialogContent>
                <DialogContentText id="delete-hotel-description">Are you sure you want to delete this hotel? All bookings and staff links will be removed. This cannot be undone.</DialogContentText>
              </DialogContent>
              <DialogActions>
                <Button onClick={handleDeleteHotelCancel} color="primary" autoFocus>
                  Cancel
                </Button>
                <Button onClick={handleDeleteHotelConfirm} color="error" variant="contained">
                  Delete
                </Button>
              </DialogActions>
            </Dialog>
          </CardContent>
        </Card>
      </MotionBox>
    </Container>
  );
}

export default HotelDetails;
