import React, { useEffect, useState } from 'react';
import { Box, Button, Grid, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import EmailIcon from '@mui/icons-material/Email';
import request from '../helper/api';
import RequestCard from './cards/RequestCard';
import BookingCard from './cards/BookingCard';
import HotelIcon from '@mui/icons-material/Hotel';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import BedtimeIcon from '@mui/icons-material/Bedtime';

import { NAVY, MUTED, BORDER, SHADOW } from '../theme';
import constants from '../constants.json';

const LABEL_SX = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: MUTED,
  mb: 2,
};

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <Box sx={{ bgcolor: 'background.paper', borderRadius: 3, p: 2.5, border: `1px solid ${BORDER}`, boxShadow: SHADOW }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon sx={{ fontSize: 20, color: '#fff' }} />
          </Box>
        </Box>
        <Typography sx={{ fontSize: 28, fontWeight: 800, color: NAVY, lineHeight: 1 }}>{value}</Typography>
        <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.5 }}>{label}</Typography>
      </Box>
    </motion.div>
  );
}

const Dashboard = ({ account, navigate, alertError, alertSuccess, setLoading, BRAND_GRADIENT }) => {
  const [bookings, setBookings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [sendingInvites, setSendingInvites] = useState(false);

  const handleSendPendingInvites = async () => {
    setSendingInvites(true);
    try {
      const result = await request({
        endpoint: '/bookings/send-pending-invites',
        method: 'POST',
        setLoading,
        alertError,
        throw: true,
      });
      if (result?.message) alertSuccess?.(result.message);
    } finally {
      setSendingInvites(false);
    }
  };

  useEffect(() => {
    request({ endpoint: '/bookings', method: 'GET', setData: setBookings, defaultData: [], alertError });
    request({ endpoint: '/requests', method: 'GET', setData: setRequests, defaultData: [], alertError });
  }, []);

  const activeBookings = bookings.filter((b) => b.isWithinStay).length;
  const pendingRequests = requests.filter((r) => r.status === 'pending').length;
  const completedRequests = requests.filter((r) => r.status === 'completed').length;

  const recentBookings = bookings.slice(0, 4);
  const recentRequests = requests.slice(0, 4);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pt: 3, pb: 6, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Typography sx={{ fontSize: 26, fontWeight: 700, color: NAVY, mb: 0.5 }}>
          {greeting()}
          {account?.name ? `, ${account.name.split(' ')[0]}` : ''}
        </Typography>
        <Typography sx={{ fontSize: 13, color: MUTED, mb: 4 }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Typography>
        {!!constants.PERMISSIONS.CAN_SEND_INVITES[account?.role] && (
          <Button variant="outlined" startIcon={<EmailIcon />} onClick={handleSendPendingInvites} disabled={sendingInvites} sx={{ textTransform: 'none', fontWeight: 600, mb: 2 }}>
            {sendingInvites ? 'Sending…' : 'Fire invite emails'}
          </Button>
        )}
      </motion.div>

      {/* Stats row */}
      <Grid container spacing={2} sx={{ mb: 5 }}>
        {[
          { icon: HotelIcon, label: 'Total Bookings', value: bookings.length, accent: BRAND_GRADIENT },
          { icon: BedtimeIcon, label: 'Active Now', value: activeBookings, accent: 'linear-gradient(135deg,#1B2340,#263462)' },
          { icon: PendingActionsIcon, label: 'Pending Requests', value: pendingRequests, accent: 'linear-gradient(135deg,#C5A022,#B8860B)' },
          { icon: CheckCircleOutlineIcon, label: 'Completed', value: completedRequests, accent: 'linear-gradient(135deg,#059669,#047857)' },
        ].map((s, i) => (
          <Grid item xs={6} md={3} key={s.label}>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, duration: 0.35 }}>
              <StatCard {...s} />
            </motion.div>
          </Grid>
        ))}
      </Grid>

      {/* Recent Requests */}
      <Box sx={{ mb: 5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography sx={LABEL_SX}>Recent Requests</Typography>
          <Typography onClick={() => navigate('/requests')} sx={{ fontSize: 12, fontWeight: 700, color: 'primary.main', cursor: 'pointer' }}>
            View all
          </Typography>
        </Box>
        {recentRequests.length > 0 ? (
          <Grid container spacing={2}>
            {recentRequests.map((req, i) => (
              <Grid item xs={12} sm={6} md={3} key={req.id}>
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
                  <RequestCard data={req} navigate={navigate} account={account} />
                </motion.div>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Typography sx={{ fontSize: 13, color: MUTED }}>No recent requests.</Typography>
        )}
      </Box>

      {/* Recent Bookings */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography sx={LABEL_SX}>Recent Bookings</Typography>
          <Typography onClick={() => navigate('/bookings')} sx={{ fontSize: 12, fontWeight: 700, color: 'primary.main', cursor: 'pointer' }}>
            View all
          </Typography>
        </Box>
        {recentBookings.length > 0 ? (
          <Grid container spacing={2}>
            {recentBookings.map((booking, i) => (
              <Grid item xs={12} sm={6} md={3} key={booking.id}>
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.06 }}>
                  <BookingCard data={booking} navigate={navigate} />
                </motion.div>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Typography sx={{ fontSize: 13, color: MUTED }}>No recent bookings.</Typography>
        )}
      </Box>
    </Box>
  );
};

export default Dashboard;
