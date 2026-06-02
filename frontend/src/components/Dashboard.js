import { useEffect, useState } from 'react';
import { Box, Button, Chip, Grid, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import EmailIcon from '@mui/icons-material/Email';
import request from '../helper/api';
import MapComponent from './MapComponent';
import { StatCard, CardHeader, SectionHeader, ColumnLabel, LABEL_SX, CARD_SX } from './cards/AppCards';
import { RequestRow, ActionItem } from './cards/RequestCard';
import { BookingRow } from './cards/BookingCard';
import { PropertyRow } from './cards/HotelCard';
import {
  NAVY, NAVY_GRADIENT, NAVY_CONTRAST, MUTED, BORDER,
  BRAND_GRADIENT, PRIMARY_CONTRAST, TEXT_MUTED_LIGHT,
  STATUS_WARNING, STATUS_ERROR, STATUS_ERROR_BG, STATUS_SUCCESS,
} from '../theme';
import constants from '../constants.json';

const PROPERTY_PULSE_COLS = ['Property', 'Active Guests', "Today's Arrivals", 'Open Requests'];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const Dashboard = ({ account, navigate, alertError, alertSuccess, setLoading }) => {
  const [dashboard, setDashboard] = useState(null);

  const handleSendPendingInvites = async () => {
    await request({ endpoint: '/bookings/send-pending-invites', method: 'POST', setLoading, alertError, alertSuccess });
  };

  useEffect(() => {
    let inFlight = false;
    const fetchAll = async () => {
      if (inFlight) return;
      inFlight = true;
      await request({ endpoint: '/dashboard', method: 'GET', setData: setDashboard, setLoading, alertError });
      inFlight = false;
    };
    fetchAll();
    const onVisible = () => { if (!document.hidden) fetchAll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  if (!dashboard) return null;

  const now = new Date();
  const { stats, propertyRows, actionQueue, recentRequests: recentReqs, recentBookings: recentBooks } = dashboard;

  const isGuest   = account?.role === constants.ACCOUNT_ROLES.GUEST;
  const isStaff   = account?.role === constants.ACCOUNT_ROLES.HOTEL_STAFF;
  const canInvite = !!constants.PERMISSIONS.CAN_SEND_INVITES[account?.role];
  const firstName = account?.name?.split(' ')[0] || '';
  const dateLabel = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const kpis = isGuest ? [
    { label: 'My Stays',    value: stats.totalBookings,    accent: NAVY,          sub: 'Total bookings' },
    { label: 'Active Stay', value: stats.activeBookings,   accent: STATUS_WARNING, sub: 'Currently checked in' },
    { label: 'My Requests', value: stats.pendingRequests,  accent: STATUS_ERROR,   sub: 'Awaiting action' },
    { label: 'Completed',   value: stats.completedRequests, accent: STATUS_SUCCESS, sub: 'Resolved' },
  ] : [
    { label: 'Total Bookings',   value: stats.totalBookings,    accent: NAVY,          sub: 'All bookings' },
    { label: 'Active Stays',     value: stats.activeBookings,   accent: STATUS_WARNING, sub: 'Currently checked in' },
    { label: 'Pending Requests', value: stats.pendingRequests,  accent: STATUS_ERROR,   sub: 'Awaiting action' },
    { label: 'Completed',        value: stats.completedRequests, accent: STATUS_SUCCESS, sub: 'Resolved' },
  ];

  // ── Guest view ──────────────────────────────────────────────────────────
  if (isGuest) {
    return (
      <Box sx={{ px: { xs: 1.5, sm: 2.5, md: 3 }, pb: 6, maxWidth: 900, mx: 'auto' }}>
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Typography sx={{ ...LABEL_SX, mb: 1 }}>{dateLabel}</Typography>
          <Typography sx={{ fontSize: { xs: 24, md: 30 }, fontWeight: 800, color: NAVY, letterSpacing: '-0.02em', mb: 3 }}>
            {greeting()}{firstName ? `, ${firstName}` : ''}.
          </Typography>
        </motion.div>
        <Grid container spacing={{ xs: 1, sm: 1.5, md: 1.75 }} sx={{ mb: 3 }}>
          <MapComponent Component={StatCard} data={kpis} showNoDataAvailable={false} />
        </Grid>
        <Grid container spacing={{ xs: 1.5, md: 2.5 }}>
          <Grid item xs={12} sm={6} md={6}>
            <Box sx={CARD_SX}>
              <SectionHeader label="My Requests" title="Recent activity" onViewAll={() => navigate('/requests')} />
              <MapComponent Component={RequestRow} data={recentReqs} showNoDataAvailable={false} navigate={navigate} />
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={6}>
            <Box sx={CARD_SX}>
              <SectionHeader label="My Bookings" title="Your stays" onViewAll={() => navigate('/bookings')} />
              <MapComponent Component={BookingRow} data={recentBooks} showNoDataAvailable={false} navigate={navigate} now={now} />
            </Box>
          </Grid>
        </Grid>
      </Box>
    );
  }

  // ── Staff view ──────────────────────────────────────────────────────────
  if (isStaff) {
    return (
      <Box sx={{ px: { xs: 1.5, sm: 2.5, md: 3 }, pb: 6, maxWidth: 900, mx: 'auto' }}>
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Typography sx={{ ...LABEL_SX, mb: 1 }}>{dateLabel}</Typography>
          <Typography sx={{ fontSize: { xs: 24, md: 30 }, fontWeight: 800, color: NAVY, letterSpacing: '-0.02em', mb: 3 }}>
            {greeting()}{firstName ? `, ${firstName}` : ''}.
          </Typography>
        </motion.div>
        <Grid container spacing={{ xs: 1.5, md: 2.5 }}>
          <Grid item xs={12} sm={6}>
            <Box sx={CARD_SX}>
              <SectionHeader label="Recent Requests" title="Last 24 hours" onViewAll={() => navigate('/requests')} />
              <MapComponent Component={RequestRow} data={recentReqs} showNoDataAvailable={false} navigate={navigate} />
            </Box>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box sx={{ ...CARD_SX, height: '100%' }}>
              <CardHeader eyebrow="Action queue" eyebrowColor={STATUS_ERROR} title="Needs attention"
                right={actionQueue.length > 0 ? <Chip label={actionQueue.length} size="small" sx={{ fontSize: 10, height: 20, fontWeight: 700, bgcolor: STATUS_ERROR_BG, color: STATUS_ERROR, border: 'none' }} /> : null} />
              <MapComponent Component={ActionItem} data={actionQueue} showNoDataAvailable={false} navigate={navigate} />
            </Box>
          </Grid>
        </Grid>
      </Box>
    );
  }

  // ── Admin / owner view ──────────────────────────────────────────────────
  return (
    <Box sx={{ px: { xs: 1.5, sm: 2.5, md: 3 }, pb: 6, maxWidth: 1200, mx: 'auto' }}>

      {/* Mobile hero */}
      <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 2.5 }}>
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Box sx={{ background: NAVY_GRADIENT, color: NAVY_CONTRAST, borderRadius: 3, p: { xs: '18px 18px 22px', sm: '22px 24px 26px' }, overflow: 'hidden' }}>
            <Typography sx={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: TEXT_MUTED_LIGHT, mb: 1 }}>{dateLabel}</Typography>
            <Typography sx={{ fontSize: { xs: 22, sm: 26 }, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.1 }}>{greeting()},<br />{firstName}.</Typography>
            <Typography sx={{ fontSize: 11.5, opacity: 0.78, mt: 1, lineHeight: 1.5 }}>
              {stats.totalBookings} bookings · {stats.activeBookings} active
              {stats.urgentRequests > 0 && <> · <Box component="span" sx={{ color: TEXT_MUTED_LIGHT, fontWeight: 700 }}>{stats.urgentRequests} urgent</Box></>}
            </Typography>
            {canInvite && (
              <Button size="small" startIcon={<EmailIcon sx={{ fontSize: 12 }} />} onClick={handleSendPendingInvites}
                sx={{ mt: 1.75, background: BRAND_GRADIENT, color: PRIMARY_CONTRAST, fontWeight: 800, fontSize: 12, textTransform: 'none', borderRadius: 2, boxShadow: 'none' }}>
                Fire pending invites
              </Button>
            )}
          </Box>
        </motion.div>
      </Box>

      {/* Desktop header */}
      <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'flex-end', justifyContent: 'space-between', mb: 4, gap: 3 }}>
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Typography sx={{ ...LABEL_SX, mb: 1.25 }}>{dateLabel}</Typography>
          <Typography sx={{ fontSize: 32, fontWeight: 800, color: NAVY, letterSpacing: '-0.02em', lineHeight: 1.05 }}>
            {greeting()}{firstName ? `, ${firstName}` : ''}.
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: MUTED, mt: 1 }}>
            {stats.totalBookings} bookings · {stats.activeBookings} active stays
            {stats.urgentRequests > 0 && <> · <Box component="span" sx={{ color: STATUS_ERROR, fontWeight: 700 }}>{stats.urgentRequests} urgent</Box></>}
          </Typography>
        </motion.div>
        {canInvite && (
          <Button variant="contained" startIcon={<EmailIcon sx={{ fontSize: 14 }} />} onClick={handleSendPendingInvites}
            sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12.5, borderRadius: 2, boxShadow: 'none', whiteSpace: 'nowrap' }}>
            Fire pending invites
          </Button>
        )}
      </Box>

      {/* KPI strip */}
      <Grid container spacing={{ xs: 1, sm: 1.5, md: 1.75 }} sx={{ mb: { xs: 2.5, md: 3.5 } }}>
        <MapComponent Component={StatCard} data={kpis} showNoDataAvailable={false} />
      </Grid>

      {/* Property pulse + Action queue */}
      <Grid container spacing={{ xs: 1.5, md: 2.5 }} sx={{ mb: { xs: 2, md: 3 } }}>
        <Grid item xs={12} sm={12} md={8}>
          <Box sx={CARD_SX}>
            <CardHeader eyebrow="Live" eyebrowColor={STATUS_WARNING} title="Property pulse"
              right={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#059669' }} /><Typography sx={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>Live</Typography></Box>} />
            <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: '2fr 1fr 1fr 1fr', px: 2.5, py: 1, borderBottom: `1px solid ${BORDER}` }}>
              <MapComponent Component={ColumnLabel} data={PROPERTY_PULSE_COLS} showNoDataAvailable={false} />
            </Box>
            <MapComponent Component={PropertyRow} data={propertyRows} showNoDataAvailable={false} navigate={navigate} />
            <Box sx={{ px: 2.5, py: 1.25, borderTop: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontSize: 12, color: MUTED }}>Properties needing attention</Typography>
              <Typography onClick={() => navigate('/hotels')} sx={{ fontSize: 12, fontWeight: 700, color: 'primary.main', cursor: 'pointer' }}>View all →</Typography>
            </Box>
          </Box>
        </Grid>

        <Grid item xs={12} sm={12} md={4}>
          <Box sx={{ ...CARD_SX, height: '100%' }}>
            <CardHeader eyebrow="Action queue" eyebrowColor={STATUS_ERROR} title="Needs attention"
              right={actionQueue.length > 0 ? <Chip label={actionQueue.length} size="small" sx={{ fontSize: 10, height: 20, fontWeight: 700, bgcolor: STATUS_ERROR_BG, color: STATUS_ERROR, border: 'none' }} /> : null} />
            <MapComponent Component={ActionItem} data={actionQueue} showNoDataAvailable={false} navigate={navigate} />
          </Box>
        </Grid>
      </Grid>

      {/* Recent requests + bookings */}
      <Grid container spacing={{ xs: 1.5, md: 2.5 }}>
        <Grid item xs={12} sm={6} md={6}>
          <Box sx={CARD_SX}>
            <SectionHeader label="Recent Requests" title="Last 24 hours" onViewAll={() => navigate('/requests')} />
            <MapComponent Component={RequestRow} data={recentReqs} showNoDataAvailable={false} navigate={navigate} />
          </Box>
        </Grid>
        <Grid item xs={12} sm={6} md={6}>
          <Box sx={CARD_SX}>
            <SectionHeader label="Recent Bookings" title="Confirmed this week" onViewAll={() => navigate('/bookings')} />
            <MapComponent Component={BookingRow} data={recentBooks} showNoDataAvailable={false} navigate={navigate} now={now} />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
