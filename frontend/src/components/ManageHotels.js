import React, { useEffect, useState } from 'react';
import { Box, Button, Container, Dialog, DialogActions, DialogContent, DialogTitle, TableCell, TableRow, TextField, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import DataTable from './DataTable';
import request from '../helper/api';

const MotionBox = motion(Box);

const HotelRow = ({ data, navigate }) => {
  const hotel = data;

  const handleClick = () => {
    if (hotel && hotel.id) {
      navigate(`/hotels/${hotel.id}`);
    }
  };

  return (
    <TableRow hover onClick={handleClick} sx={{ cursor: 'pointer' }}>
      <TableCell>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {hotel.name}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {hotel.address}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {hotel.checkInTime || '-'} / {hotel.checkOutTime || '-'}
        </Typography>
      </TableCell>
    </TableRow>
  );
};

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

  const hotelColumns = [
    { key: 'name', label: 'Name' },
    { key: 'address', label: 'Address' },
    { key: 'checkInOut', label: 'Check-in / Check-out' },
  ];

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
            <DataTable columns={hotelColumns} RowComponent={HotelRow} data={hotels} isLoading={loading} navigate={navigate} />
          </Box>
        </Box>
      </MotionBox>
    </Container>
  );
}

export default ManageHotels;
