import React from 'react';
import { Box } from '@mui/material';
import { AvatarChatbot } from './AvatarChatbot/index';

const Home = () => {
  return (
    <Box
      sx={{
        width: '100%',
        height: '100vh',
        bgcolor: 'background.default', // Use theme background
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AvatarChatbot />
    </Box>
  );
};

export default Home;
