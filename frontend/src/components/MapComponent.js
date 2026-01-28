import React from 'react';
import { Box, Typography } from '@mui/material';
import NoDataFound from './NoDataFound';

function MapComponent({ Component, data, showNoDataAvailable = true, ...props }) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    if (showNoDataAvailable) {
      return <NoDataFound />;
    }
    return null;
  }

  return (
    <>
      {data.map((row, index) => (
        <Component key={index} data={row} index={index} {...props} />
      ))}
    </>
  );
}

export default MapComponent;
