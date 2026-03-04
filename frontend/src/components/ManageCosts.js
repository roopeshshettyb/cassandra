import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import request from '../helper/api';

import { GOLD_GRADIENT, NAVY, MUTED } from '../theme';

function ManageCosts({ setLoading, account, alertError }) {
  const [costs, setCosts] = useState([]);

  useEffect(() => {
    if (account && (account.role === 'admin' || account.role === 'hotel_owner')) {
      request({ endpoint: '/costs/aggregate', method: 'GET', setLoading, setData: setCosts, defaultData: [], alertError });
    }
  }, [account, setLoading, alertError]);

  if (!account || (account.role !== 'admin' && account.role !== 'hotel_owner')) {
    return (
      <Box sx={{ px: 3, pt: 3 }}>
        <Typography sx={{ color: '#DC2626', fontWeight: 600 }}>You are not authorized to view this page.</Typography>
      </Box>
    );
  }

  const formatCurrency = (amount, currency) => {
    let val = parseFloat(amount || 0);
    if (currency?.toLowerCase() === 'usd') val = val * 86;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  };

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pt: 3, pb: 6, maxWidth: 1200, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'primary.main', mb: 0.5 }}>
            Analytics
          </Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 700, color: NAVY }}>Costs</Typography>
          <Typography sx={{ fontSize: 13, color: MUTED, mt: 0.5 }}>Aggregated AI usage costs per booking</Typography>
        </Box>
      </motion.div>

      {/* Table card */}
      <Box sx={{ bgcolor: '#fff', borderRadius: 3, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        {/* Header row */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr auto', gap: 2, px: 3, py: 1.5, borderBottom: '1px solid rgba(0,0,0,0.07)', background: 'linear-gradient(135deg, #1B2340 0%, #263462 100%)' }}>
          {['Booking', 'Guest', 'Email', 'Total Cost'].map((h) => (
            <Typography key={h} sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>{h}</Typography>
          ))}
        </Box>

        {costs.length > 0 ? (
          costs.map((row, i) => (
            <motion.div key={row.id || row.bookingId || i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '80px 1fr 1fr auto',
                  gap: 2,
                  px: 3,
                  py: 2,
                  borderBottom: i < costs.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                  '&:hover': { bgcolor: 'rgba(212,175,55,0.04)' },
                }}
              >
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: NAVY, fontFamily: 'monospace' }}>#{row.bookingId || '—'}</Typography>
                <Typography sx={{ fontSize: 13, color: NAVY, fontWeight: 500 }}>{row.guestName || '—'}</Typography>
                <Typography sx={{ fontSize: 13, color: MUTED }}>{row.guestEmail || '—'}</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>{formatCurrency(row.totalCost, row.currency)}</Typography>
              </Box>
            </motion.div>
          ))
        ) : (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 14, color: MUTED }}>No cost data available</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default ManageCosts;
