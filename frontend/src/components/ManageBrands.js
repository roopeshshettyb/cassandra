import { Box } from '@mui/material';
import { motion } from 'framer-motion';
import useListControls from '../helper/useListControls';
import DataGrid from './DataGrid';
import ListControls from './ListControls';
import BrandCard from './cards/BrandCard';
import { PageHeader } from './cards/AppCards';

function ManageBrands({ loading, setLoading, account, navigate, alertError }) {
  // The brands list is nested under /hotels, so its filters sit at /hotels/brands/filters.
  const list = useListControls({ endpoint: '/hotels/brands', setLoading, alertError });

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pb: 6, maxWidth: 1200, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader title="Brands" />
      </motion.div>
      <ListControls list={list} />
      <DataGrid CardComponent={BrandCard} data={list.data} isLoading={loading} navigate={navigate} />
    </Box>
  );
}

export default ManageBrands;
