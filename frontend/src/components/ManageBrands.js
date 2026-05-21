import { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import { motion } from 'framer-motion';
import request from '../helper/api';
import DataGrid from './DataGrid';
import BrandCard from './cards/BrandCard';
import { PageHeader, SearchBar } from './cards/AppCards';

function ManageBrands({ loading, setLoading, account, navigate, alertError }) {
  const [brands, setBrands] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    request({ endpoint: '/hotels/brands', method: 'GET', setLoading, setData: setBrands, defaultData: [], alertError, delay: false });
  }, []);

  const visible = search
    ? brands.filter(b => b.name?.toLowerCase().includes(search.toLowerCase()))
    : brands;

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pb: 6, maxWidth: 1200, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader title="Brands" />
        <Box sx={{ mb: 3 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search brands…" />
        </Box>
      </motion.div>
      <DataGrid CardComponent={BrandCard} data={visible} isLoading={loading} navigate={navigate} />
    </Box>
  );
}

export default ManageBrands;
