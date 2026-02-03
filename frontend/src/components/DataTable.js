import React from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import MapComponent from './MapComponent';
import NoDataFound from './NoDataFound';

function DataTable({ columns, RowComponent, data, isLoading, showNoDataAvailable = false, ...rowProps }) {
  if (!isLoading && !(data?.length > 0)) {
    return <NoDataFound />;
  }
  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell key={col.key}>{col.label}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          <MapComponent Component={RowComponent} data={data} isLoading={isLoading} showNoDataAvailable={showNoDataAvailable} {...rowProps} />
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default DataTable;
