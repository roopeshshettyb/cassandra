import { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import request from '../helper/api';
import DataGrid from './DataGrid';
import BrandCard from './cards/BrandCard';
import { NAVY } from '../theme';

function ManageBrands({ loading, setLoading, account, navigate, alertError }) {
  const [brands, setBrands] = useState([]);

  useEffect(() => {
    request({ endpoint: '/hotels/brands', method: 'GET', setLoading, setData: setBrands, defaultData: [], alertError });
  }, []);

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pb: 6, maxWidth: 1200, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <Box sx={{ mb: 2.5 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'primary.main', mb: 0.5 }}>Management</Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 700, color: NAVY }}>Brands</Typography>
        </Box>
      </motion.div>
      <DataGrid CardComponent={BrandCard} data={brands} isLoading={loading} navigate={navigate} />
    </Box>
  );
}

export default ManageBrands;
