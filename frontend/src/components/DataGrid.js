import React from 'react';
import { Grid, Box, CircularProgress } from '@mui/material';
import { motion } from 'framer-motion';
import MapComponent from './MapComponent';

const MotionGrid = motion(Grid);

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

function DataGrid({ CardComponent, data, isLoading, showNoDataAvailable = true, gridItemProps = { xs: 12, sm: 6, md: 4 }, ...props }) {
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Wrapper to make MapComponent render Grid items
  const GridItemWrapper = ({ data: rowData, index, ...rest }) => (
    <Grid item {...gridItemProps} component={motion.div} variants={item}>
      <CardComponent data={rowData} {...rest} />
    </Grid>
  );

  return (
    <MotionGrid container spacing={3} variants={container} initial="hidden" animate="show">
      <MapComponent Component={GridItemWrapper} data={data} isLoading={isLoading} showNoDataAvailable={showNoDataAvailable} {...props} />
    </MotionGrid>
  );
}

export default DataGrid;
