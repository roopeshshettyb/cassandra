import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import request from '../helper/api';
import DataGrid from './DataGrid';
import HotelCard from './cards/HotelCard';
import { BRAND_GRADIENT, NAVY, PRIMARY_CONTRAST, SHADOW } from '../theme';
import constants from '../constants.json';
import AddHotelOnboarding from './AddHotelOnboarding';

function ManageHotels({ loading, setLoading, account, navigate, alertSuccess, alertError }) {
  const [hotels, setHotels] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchHotels = async () => {
    await request({ endpoint: '/hotels', method: 'GET', setLoading, defaultData: [], alertError, setData: setHotels });
  };

  useEffect(() => {
    if (account) fetchHotels();
  }, [account]);

  const handleHotelOnboarded = () => {
    fetchHotels();
    setShowAddForm(false);
  };

  const CAN_ADD_HOTEL = !!constants.PERMISSIONS.CAN_ADD_HOTEL[account?.role];

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pb: 6, maxWidth: 1200, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: { xs: 'flex-end', sm: 'space-between' }, mb: 2.5, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'primary.main', mb: 0.5 }}>Management</Typography>
            <Typography sx={{ fontSize: 26, fontWeight: 700, color: NAVY }}>Hotels</Typography>
          </Box>
          {CAN_ADD_HOTEL && (
            <motion.button
              onClick={() => setShowAddForm(true)}
              whileTap={{ scale: 0.97 }}
              style={{ background: BRAND_GRADIENT, border: 'none', borderRadius: 10, padding: '10px 22px', color: PRIMARY_CONTRAST, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: SHADOW }}
            >
              + Add Hotel
            </motion.button>
          )}
        </Box>
      </motion.div>

      <AddHotelOnboarding
        open={showAddForm && CAN_ADD_HOTEL}
        onClose={() => setShowAddForm(false)}
        onHotelCreated={handleHotelOnboarded}
        alertError={alertError}
        alertSuccess={alertSuccess}
      />

      <DataGrid CardComponent={HotelCard} data={hotels} isLoading={loading} navigate={navigate} />
    </Box>
  );
}

export default ManageHotels;
