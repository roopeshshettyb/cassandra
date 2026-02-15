import React, { useEffect, useState } from 'react';
import { Box, Button, Container, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { motion } from 'framer-motion';
import request from '../helper/api';
import DataGrid from './DataGrid';
import HotelCard from './cards/HotelCard';

const MotionBox = motion(Box);

function ManageHotels({ loading, setLoading, account, navigate, alertSuccess, alertError, isMobile }) {
  const [hotels, setHotels] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formValues, setFormValues] = useState({
    name: '',
    address: '',
    checkInTime: '',
    checkOutTime: '',
  });

  const fetchHotels = async () => {
    const response = await request({
      endpoint: '/hotels',
      method: 'GET',
      setLoading,
      defaultData: [],
      alertError,
      setData: setHotels,
    });
  };

  useEffect(() => {
    if (account) {
      fetchHotels();
    }
  }, [account]);

  const handleInputChange = (field) => (event) => {
    setFormValues((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleCreateHotel = async (event) => {
    event.preventDefault();
    if (!formValues.name || !formValues.address) {
      alertError && alertError('Name and address are required');
      return;
    }

    setCreating(true);
    try {
      await request({
        endpoint: '/hotels',
        method: 'POST',
        data: formValues,
        setLoading,
        alertSuccess,
        alertError,
      });
      setFormValues({
        name: '',
        address: '',
        checkInTime: '',
        checkOutTime: '',
      });
      setShowAddForm(false);
      await fetchHotels();
    } finally {
      setCreating(false);
    }
  };

  const canAddHotel = account && account.role === 'admin';

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <MotionBox initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: isMobile ? 'flex-start' : 'flex-end',
              alignItems: isMobile ? 'flex-end' : 'center',
              gap: 2,
            }}
          >
            {canAddHotel && (
              <Button variant="contained" color="primary" onClick={() => setShowAddForm(true)}>
                Add Hotel
              </Button>
            )}
          </Box>

          <Dialog open={showAddForm && canAddHotel} onClose={() => setShowAddForm(false)} fullWidth maxWidth="sm">
            <DialogTitle>Add Hotel</DialogTitle>
            <Box component="form" onSubmit={handleCreateHotel}>
              <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                  <TextField fullWidth label="Name" value={formValues.name} onChange={handleInputChange('name')} />
                  <TextField fullWidth label="Address" value={formValues.address} onChange={handleInputChange('address')} />
                  <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 2 }}>
                    <TextField fullWidth label="Check-in Time" type="time" value={formValues.checkInTime} onChange={handleInputChange('checkInTime')} inputProps={{ step: 60 }} />
                    <TextField fullWidth label="Check-out Time" type="time" value={formValues.checkOutTime} onChange={handleInputChange('checkOutTime')} inputProps={{ step: 60 }} />
                  </Box>
                </Box>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setShowAddForm(false)}>Cancel</Button>
                <Button type="submit" variant="contained" color="primary" disabled={creating}>
                  {creating ? 'Saving...' : 'Save Hotel'}
                </Button>
              </DialogActions>
            </Box>
          </Dialog>

          <Box>
            <DataGrid CardComponent={HotelCard} data={hotels} isLoading={loading} navigate={navigate} />
          </Box>
        </Box>
      </MotionBox>
    </Container>
  );
}

export default ManageHotels;
