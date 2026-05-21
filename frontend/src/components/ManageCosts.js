import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { motion } from 'framer-motion';
import request from '../helper/api';

import { BRAND_GRADIENT, NAVY, MUTED, BORDER, SHADOW, TEXT_MUTED_LIGHT, HOVER_BG } from '../theme';
import { PageHeader } from './cards/AppCards';
import constants from '../constants.json';

function ManageCosts({ loading, setLoading, account, alertError }) {
  const [costs, setCosts] = useState([]);

  useEffect(() => {
    if (account && constants.PERMISSIONS.CAN_VIEW_COSTS[account.role]) {
      request({ endpoint: '/costs/aggregate', method: 'GET', setLoading, setData: setCosts, defaultData: [], alertError, delay: false });
    }
  }, [account]);

  if (!account || !constants.PERMISSIONS.CAN_VIEW_COSTS[account.role]) {
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

  const COLS = { xs: '60px 1fr auto', sm: '80px 1fr 1fr auto' };

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pt: { xs: '4vh', sm: 1.5 }, pb: 6, maxWidth: 1200, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader eyebrow="Analytics" title="Costs" />
        <Typography sx={{ fontSize: 13, color: MUTED, mt: -1.5, mb: 2.5, display: { xs: 'none', sm: 'block' } }}>Aggregated AI usage costs per booking</Typography>
      </motion.div>

      {/* Table card */}
      <Box sx={{ bgcolor: 'background.paper', borderRadius: 3, border: `1px solid ${BORDER}`, boxShadow: SHADOW, overflow: 'hidden' }}>
        {/* Header row — Email col hidden on mobile, Cost stays last */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: COLS,
            gap: { xs: 1, sm: 2 },
            px: { xs: 2, sm: 3 },
            py: 1.5,
            borderBottom: `1px solid ${BORDER}`,
            background: 'var(--app-navy-gradient)',
          }}
        >
          {['Booking', 'Guest'].map((h) => (
            <Typography key={h} sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: TEXT_MUTED_LIGHT }}>
              {h}
            </Typography>
          ))}
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: TEXT_MUTED_LIGHT, display: { xs: 'none', sm: 'block' } }}>
            Email
          </Typography>
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: TEXT_MUTED_LIGHT }}>Cost</Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : costs.length > 0 ? (
          costs.map((row, i) => (
            <motion.div key={row.id || row.bookingId || i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: COLS,
                  gap: { xs: 1, sm: 2 },
                  px: { xs: 2, sm: 3 },
                  py: 2,
                  borderBottom: i < costs.length - 1 ? `1px solid ${BORDER}` : 'none',
                  '&:hover': { bgcolor: HOVER_BG },
                }}
              >
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: NAVY, fontFamily: 'monospace' }}>#{row.bookingId || '—'}</Typography>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13, color: NAVY, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.guestName || '—'}</Typography>
                  <Typography sx={{ fontSize: 11, color: MUTED, display: { xs: 'block', sm: 'none' }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.guestEmail || ''}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: 13, color: MUTED, display: { xs: 'none', sm: 'block' }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.guestEmail || '—'}
                </Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#059669', whiteSpace: 'nowrap' }}>{formatCurrency(row.totalCost, row.currency)}</Typography>
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
