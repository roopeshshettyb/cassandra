import React, { useEffect, useState } from 'react';
import { Box, Container, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { motion } from 'framer-motion';
import request from '../helper/api';

const MotionBox = motion(Box);

function ManageCosts({ setLoading, account, alertError }) {
  const [costs, setCosts] = useState([]);

  useEffect(() => {
    const fetchCosts = async () => {
      await request({
        endpoint: '/costs/aggregate',
        method: 'GET',
        setLoading,
        setData: setCosts,
        defaultData: [],
        alertError,
      });
    };

    if (account && (account.role === 'admin' || account.role === 'hotel_owner')) {
      fetchCosts();
    }
  }, [account, setLoading, alertError]);

  if (!account || (account.role !== 'admin' && account.role !== 'hotel_owner')) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography variant="h5" color="error">
          You are not authorized to view this page.
        </Typography>
      </Container>
    );
  }

  // Helper to format currency
  const formatCurrency = (amount, currency) => {
    // Basic conversion assumption: 1 USD = 86 INR if currency is USD
    let val = parseFloat(amount || 0);
    if (currency?.toLowerCase() === 'usd') {
      val = val * 86;
    }
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <MotionBox initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" gutterBottom>
            Manage Costs
          </Typography>
          <Typography variant="body1" color="text.secondary">
            View aggregated costs for your bookings.
          </Typography>
        </Box>

        <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2, boxShadow: 1 }}>
          <TableContainer sx={{ maxHeight: 600 }}>
            <Table stickyHeader aria-label="costs table">
              <TableHead>
                <TableRow>
                  <TableCell>Booking ID</TableCell>
                  <TableCell>Guest Name</TableCell>
                  <TableCell>Guest Email</TableCell>
                  <TableCell align="right">Total Cost (INR)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {costs.length > 0 ? (
                  costs.map((row) => (
                    <TableRow key={row.id || row.bookingId} hover>
                      <TableCell>{row.bookingId || 'N/A'}</TableCell>
                      <TableCell>{row.guestName}</TableCell>
                      <TableCell>{row.guestEmail}</TableCell>
                      <TableCell align="right">{formatCurrency(row.totalCost, row.currency)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                      <Typography variant="body1" color="text.secondary">
                        No cost data available
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </MotionBox>
    </Container>
  );
}

export default ManageCosts;
