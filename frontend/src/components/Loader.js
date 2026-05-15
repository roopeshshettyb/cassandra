import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { BACKDROP_BG } from '../theme/index';

const Loader = ({ message = 'Loading...', isMobile }) => {
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: isMobile ? 0 : '20vw',
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(10px)',
        backgroundColor: BACKDROP_BG,
        zIndex: 9999,
        gap: 2,
      }}
    >
      <CircularProgress sx={{ color: '#fff' }} />
      <Typography variant="body1" sx={{ color: '#fff', fontWeight: 500 }}>
        {message}
      </Typography>
    </Box>
  );
};

export default Loader;
