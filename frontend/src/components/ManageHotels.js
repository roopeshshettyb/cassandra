import React, { useEffect, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import request from '../helper/api';
import DataGrid from './DataGrid';
import HotelCard from './cards/HotelCard';

import { BRAND_GRADIENT, NAVY, MUTED, BORDER, PRIMARY_CONTRAST, SHADOW } from '../theme';

function ManageHotels({ loading, setLoading, account, navigate, alertSuccess, alertError, isMobile }) {
  const [hotels, setHotels] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formValues, setFormValues] = useState({ name: '', address: '', checkInTime: '', checkOutTime: '' });
  const [dataLoading, setDataLoading] = useState(true);

  const fetchHotels = async () => {
    await request({ endpoint: '/hotels', method: 'GET', setLoading: setDataLoading, defaultData: [], alertError, setData: setHotels });
  };

  useEffect(() => {
    if (account) fetchHotels();
  }, [account]);

  const handleInputChange = (field) => (e) => setFormValues((prev) => ({ ...prev, [field]: e.target.value }));

  const handleCreateHotel = async (e) => {
    e.preventDefault();
    if (!formValues.name || !formValues.address) {
      alertError?.('Name and address are required');
      return;
    }
    setCreating(true);
    try {
      await request({ endpoint: '/hotels', method: 'POST', data: formValues, setLoading, alertSuccess, alertError });
      setFormValues({ name: '', address: '', checkInTime: '', checkOutTime: '' });
      setShowAddForm(false);
      await fetchHotels();
    } finally {
      setCreating(false);
    }
  };

  const canAddHotel = account?.role === 'admin';

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pt: { xs: '4vh', sm: 1.5 }, pb: 6, maxWidth: 1200, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: { xs: 'flex-end', sm: 'space-between' }, mb: 2.5, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'primary.main', mb: 0.5 }}>Management</Typography>
            <Typography sx={{ fontSize: 26, fontWeight: 700, color: NAVY }}>Hotels</Typography>
          </Box>
          {canAddHotel && (
            <motion.button
              onClick={() => setShowAddForm(true)}
              whileTap={{ scale: 0.97 }}
              style={{
                background: BRAND_GRADIENT,
                border: 'none',
                borderRadius: 10,
                padding: '10px 22px',
                color: PRIMARY_CONTRAST,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: SHADOW,
              }}
            >
              + Add Hotel
            </motion.button>
          )}
        </Box>
      </motion.div>

      <Dialog open={showAddForm && canAddHotel} onClose={() => setShowAddForm(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, color: NAVY }}>Add Hotel</DialogTitle>
        <Box component="form" onSubmit={handleCreateHotel}>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField fullWidth label="Hotel Name" value={formValues.name} onChange={handleInputChange('name')} required />
              <TextField fullWidth label="Address" value={formValues.address} onChange={handleInputChange('address')} required />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  fullWidth
                  label="Check-in Time"
                  type="time"
                  value={formValues.checkInTime}
                  onChange={handleInputChange('checkInTime')}
                  inputProps={{ step: 60 }}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  fullWidth
                  label="Check-out Time"
                  type="time"
                  value={formValues.checkOutTime}
                  onChange={handleInputChange('checkOutTime')}
                  inputProps={{ step: 60 }}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setShowAddForm(false)} sx={{ color: MUTED }}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="primary" disabled={creating}>
              {creating ? 'Saving…' : 'Save Hotel'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <DataGrid CardComponent={HotelCard} data={hotels} isLoading={dataLoading} navigate={navigate} />
    </Box>
  );
}

export default ManageHotels;
