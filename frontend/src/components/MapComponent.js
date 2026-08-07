import React from 'react';
import NoDataFound from './NoDataFound';

function MapComponent({ Component, data, showNoDataAvailable = true, isLoading = false, ...props }) {
  if (isLoading && !(data?.length > 0)) {
    return null;
  }

  const isTableRowComponent = !!(Component && (Component.displayName === 'TableRow' || /row/i.test(Component.name || '')));

  if (!data || !Array.isArray(data) || data.length === 0) {
    if (showNoDataAvailable && !isTableRowComponent) {
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
