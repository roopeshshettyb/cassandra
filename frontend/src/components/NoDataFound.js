import React from 'react';
import { Box, Typography } from '@mui/material';

const NoDataFound = ({ message = 'No data found' }) => {
  return (
    <Box sx={{ textAlign: 'center', py: 8, width: '100%' }}>
      <Typography variant="h6" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
};

export default NoDataFound;

