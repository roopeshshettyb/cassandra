import React from 'react';
import { Box, Container, Typography } from '@mui/material';

function Rooms() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h4">Rooms</Typography>
        <Typography variant="body1" color="text.secondary">
          Explore and discover our curated selection of rooms. This section will be expanded with more details soon.
        </Typography>
      </Box>
    </Container>
  );
}

export default Rooms;
