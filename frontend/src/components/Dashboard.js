import React, { useEffect, useState } from 'react';
import { Box, Button, Chip, Grid, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import EmailIcon from '@mui/icons-material/Email';
import request from '../helper/api';
import MapComponent from './MapComponent';
import {
  StatCard, ListRow, TableRow, DateTileRow, ColumnLabel,
  CardHeader, SectionHeader,
  StatusChip, timeAgo,
  LABEL_SX, CARD_SX,
} from './cards/AppCards';
import {
  NAVY, NAVY_GRADIENT, NAVY_CONTRAST, MUTED, BORDER,
  BRAND_GRADIENT, PRIMARY_CONTRAST, TEXT_MUTED_LIGHT,
  STATUS_WARNING, STATUS_ERROR, STATUS_ERROR_BG,
  STATUS_SUCCESS,
} from '../theme';
import { REQUEST_TYPE_LABEL, REQUEST_STATUS, extractFirstNote } from '../constants/requestConfig';
import constants from '../constants.json';

// ── Module-level constants ──────────────────────────────────────────────────

import RoomServiceIcon from '@mui/icons-material/RoomService';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import LocalLaundryServiceIcon from '@mui/icons-material/LocalLaundryService';
import AirportShuttleIcon from '@mui/icons-material/AirportShuttle';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import {
  STATUS_WARNING_BG, STATUS_INFO_BG, STATUS_SUCCESS_BG,
} from '../theme';

const REQUEST_TYPE_CONFIG = {
  room_service:     { Icon: RoomServiceIcon,        bg: STATUS_WARNING_BG, color: STATUS_WARNING },
  house_keeping:    { Icon: CleaningServicesIcon,    bg: STATUS_INFO_BG,    color: STATUS_WARNING },
  laundry:          { Icon: LocalLaundryServiceIcon, bg: STATUS_SUCCESS_BG, color: STATUS_SUCCESS },
  airport_transfer: { Icon: AirportShuttleIcon,      bg: STATUS_INFO_BG,    color: STATUS_WARNING },
};

const URGENCY_ORDER = { high: 0, medium: 1, low: 2 };

const PROPERTY_PULSE_COLS = ['Property', 'Active Guests', "Today's Arrivals", 'Open Requests'];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// Shorten "First Last" → "F. Last"
function shortName(name) {
  if (!name) return null;
  const parts = name.split(' ').filter(Boolean);
  return parts.map((p, i) => (i === 0 ? p[0] + '.' : p)).join(' ');
}

// ── Data mappers (domain → generic card shape) ──────────────────────────────

function toStatCards(bookings, activeBookings, pendingRequests, completedRequests, isGuest) {
  return isGuest ? [
    { label: 'My Stays',    value: bookings.length,    accent: NAVY,          sub: 'Total bookings' },
    { label: 'Active Stay', value: activeBookings,     accent: STATUS_WARNING, sub: 'Currently checked in' },
    { label: 'My Requests', value: pendingRequests,    accent: STATUS_ERROR,   sub: 'Awaiting action' },
    { label: 'Completed',   value: completedRequests,  accent: STATUS_SUCCESS, sub: 'Resolved' },
  ] : [
    { label: 'Total Bookings',   value: bookings.length,   accent: NAVY,          sub: 'All bookings' },
    { label: 'Active Stays',     value: activeBookings,    accent: STATUS_WARNING, sub: 'Currently checked in' },
    { label: 'Pending Requests', value: pendingRequests,   accent: STATUS_ERROR,   sub: 'Awaiting action' },
    { label: 'Completed',        value: completedRequests, accent: STATUS_SUCCESS, sub: 'Resolved' },
  ];
}

function toListRow(r) {
  const cfg = REQUEST_TYPE_CONFIG[r.requestType] || {};
  return {
    icon:      cfg.Icon || HelpOutlineIcon,
    iconBg:    cfg.bg,
    iconColor: cfg.color,
    title:     r.hotel?.name || '—',
    subtitle:  extractFirstNote(r.userNotes) || (REQUEST_TYPE_LABEL[r.requestType] || String(r.requestType || '').replace(/_/g, ' ')) + (r.booking?.roomNumber ? ` · Rm ${r.booking.roomNumber}` : ''),
    time:      r.createdAt,
    via:       shortName(r.guest?.name),
    route:     `/requests/${r.id}`,
  };
}

function toRequestRow(r) {
  return {
    icon:      REQUEST_TYPE_CONFIG[r.requestType]?.Icon || HelpOutlineIcon,
    iconBg:    'rgba(0,0,0,0.04)',
    iconColor: MUTED,
    title:     r.hotel?.name || '—',
    subtitle:  REQUEST_TYPE_LABEL[r.requestType] || String(r.requestType || '').replace(/_/g, ' '),
    right:     <StatusChip status={r.status} />,
    time:      r.createdAt,
    route:     `/requests/${r.id}`,
  };
}

function toBookingRow(b, now) {
  const ciDate = b.startTime ? new Date(b.startTime) : null;
  const nights = ciDate && b.endTime ? Math.round((new Date(b.endTime) - ciDate) / 86400000) : null;
  const stayStatus = b.status === 'cancelled' ? 'cancelled'
    : (b.startTime && b.endTime && now >= new Date(b.startTime) && now <= new Date(b.endTime))
      ? 'in_progress' : 'confirmed';
  return {
    ciDate,
    title:    b.guest?.name || '—',
    subtitle: [b.hotel?.name || '—', nights && `${nights}n`, b.roomNumber && `Rm ${b.roomNumber}`].filter(Boolean).join(' · '),
    right:    <StatusChip status={stayStatus} />,
    route:    `/bookings/${b.id}`,
  };
}

function toTableRow(row) {
  return {
    avatar:  row.logoUrl,
    name:    row.name,
    badge:   row.open > 0 ? <Chip label={`${row.open} open req.`} size="small" sx={{ fontSize: 10, height: 18, fontWeight: 700, bgcolor: STATUS_ERROR_BG, color: STATUS_ERROR, border: 'none' }} /> : null,
    columns: [
      <Typography sx={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{row.active}</Typography>,
      <Typography sx={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{row.arrivals}</Typography>,
      row.open > 0
        ? <Chip label={row.open} size="small" sx={{ fontSize: 10, height: 20, fontWeight: 700, bgcolor: row.open > 5 ? STATUS_ERROR_BG : 'rgba(197,160,34,0.12)', color: row.open > 5 ? STATUS_ERROR : STATUS_WARNING, border: 'none' }} />
        : <Typography sx={{ fontSize: 13, color: MUTED }}>0</Typography>,
    ],
  };
}

// ── Dashboard ───────────────────────────────────────────────────────────────

const Dashboard = ({ account, navigate, alertError, alertSuccess, setLoading }) => {
  const [bookings, setBookings] = useState([]);
  const [requests, setRequests] = useState([]);

  const handleSendPendingInvites = async () => {
    await request({ endpoint: '/bookings/send-pending-invites', method: 'POST', setLoading, alertError, alertSuccess });
  };

  useEffect(() => {
    const fetchAll = (showLoader = false) => {
      if (showLoader) setLoading(true);
      Promise.all([
        request({ endpoint: '/bookings', method: 'GET', setData: setBookings, alertError }),
        request({ endpoint: '/requests', method: 'GET', setData: setRequests, alertError }),
      ]).finally(() => { if (showLoader) setLoading(false); });
    };
    fetchAll(true);
    const onVisible = () => { if (!document.hidden) fetchAll(false); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today.getTime() + 86400000);

  const activeBookings    = bookings.filter((b) => b.startTime && b.endTime && now >= new Date(b.startTime) && now <= new Date(b.endTime)).length;
  const pendingRequests   = requests.filter((r) => r.status === 'pending').length;
  const completedRequests = requests.filter((r) => r.status === 'completed').length;
  const urgentRequests    = requests.filter((r) => r.urgency === 'high' && r.status !== 'completed').length;

  // Property pulse
  const hotelMap = {};
  for (const b of bookings) {
    if (!b.hotelId) continue;
    if (!hotelMap[b.hotelId]) hotelMap[b.hotelId] = { name: b.hotel?.name || '—', logoUrl: b.hotel?.logoUrl || null, active: 0, arrivals: 0, open: 0 };
    if (b.startTime && b.endTime && now >= new Date(b.startTime) && now <= new Date(b.endTime)) hotelMap[b.hotelId].active += 1;
    if (b.startTime && new Date(b.startTime) >= today && new Date(b.startTime) < todayEnd) hotelMap[b.hotelId].arrivals += 1;
  }
  for (const r of requests) {
    if (!r.hotelId || r.status === 'completed') continue;
    if (!hotelMap[r.hotelId]) hotelMap[r.hotelId] = { name: r.hotel?.name || '—', logoUrl: null, active: 0, arrivals: 0, open: 0 };
    hotelMap[r.hotelId].open += 1;
  }

  // Map domain data → generic card shapes
  const isGuest   = account?.role === constants.ACCOUNT_ROLES.GUEST;
  const canInvite = !!constants.PERMISSIONS.CAN_SEND_INVITES[account?.role];
  const firstName = account?.name?.split(' ')[0] || '';
  const dateLabel = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const kpis          = toStatCards(bookings, activeBookings, pendingRequests, completedRequests, isGuest);
  const propertyRows  = Object.values(hotelMap).sort((a, b) => b.open - a.open).slice(0, 6).map(toTableRow);
  const actionItems   = requests.filter((r) => r.status !== 'completed' && r.status !== 'cancelled').sort((a, b) => (URGENCY_ORDER[a.urgency] ?? 3) - (URGENCY_ORDER[b.urgency] ?? 3)).slice(0, 4).map(toListRow);
  const recentReqRows = [...requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5).map(toRequestRow);
  const recentBkRows  = [...bookings].sort((a, b) => new Date(b.startTime) - new Date(a.startTime)).slice(0, 5).map((b) => toBookingRow(b, now));

  // ── Guest view ────────────────────────────────────────────────────────────
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
              <MapComponent Component={ListRow} data={recentReqRows} showNoDataAvailable={false} navigate={navigate} />
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={6}>
            <Box sx={CARD_SX}>
              <SectionHeader label="My Bookings" title="Your stays" onViewAll={() => navigate('/bookings')} />
              <MapComponent Component={DateTileRow} data={recentBkRows} showNoDataAvailable={false} navigate={navigate} />
            </Box>
          </Grid>
        </Grid>
      </Box>
    );
  }

  // ── Admin / owner / staff view ────────────────────────────────────────────
  return (
    <Box sx={{ px: { xs: 1.5, sm: 2.5, md: 3 }, pb: 6, maxWidth: 1200, mx: 'auto' }}>

      {/* Mobile hero card */}
      <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 2.5 }}>
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Box sx={{ background: NAVY_GRADIENT, color: NAVY_CONTRAST, borderRadius: 3, p: { xs: '18px 18px 22px', sm: '22px 24px 26px' }, position: 'relative', overflow: 'hidden' }}>
            <Typography sx={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: TEXT_MUTED_LIGHT, mb: 1 }}>{dateLabel}</Typography>
            <Typography sx={{ fontSize: { xs: 22, sm: 26 }, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.1 }}>
              {greeting()},<br />{firstName}.
            </Typography>
            <Typography sx={{ fontSize: 11.5, opacity: 0.78, mt: 1, lineHeight: 1.5 }}>
              {bookings.length} bookings · {activeBookings} active
              {urgentRequests > 0 && <> · <Box component="span" sx={{ color: TEXT_MUTED_LIGHT, fontWeight: 700 }}>{urgentRequests} urgent</Box></>}
            </Typography>
            {canInvite && (
              <Button size="small" startIcon={<EmailIcon sx={{ fontSize: 12 }} />} onClick={handleSendPendingInvites}
                sx={{ mt: 1.75, background: BRAND_GRADIENT, color: PRIMARY_CONTRAST, fontWeight: 800, fontSize: 12, textTransform: 'none', borderRadius: 2, boxShadow: 'none', '&:hover': { opacity: 0.9 } }}>
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
            {bookings.length} bookings · {activeBookings} active stays
            {urgentRequests > 0 && <> · <Box component="span" sx={{ color: STATUS_ERROR, fontWeight: 700 }}>{urgentRequests} urgent</Box></>}
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
            <MapComponent Component={TableRow} data={propertyRows} showNoDataAvailable={false} />
            <Box sx={{ px: 2.5, py: 1.25, borderTop: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontSize: 12, color: MUTED }}>Properties needing attention</Typography>
              <Typography onClick={() => navigate('/hotels')} sx={{ fontSize: 12, fontWeight: 700, color: 'primary.main', cursor: 'pointer' }}>View all →</Typography>
            </Box>
          </Box>
        </Grid>

        <Grid item xs={12} sm={12} md={4}>
          <Box sx={{ ...CARD_SX, height: '100%' }}>
            <CardHeader eyebrow="Action queue" eyebrowColor={STATUS_ERROR} title="Needs attention"
              right={actionItems.length > 0 ? <Chip label={actionItems.length} size="small" sx={{ fontSize: 10, height: 20, fontWeight: 700, bgcolor: STATUS_ERROR_BG, color: STATUS_ERROR, border: 'none' }} /> : null} />
            <MapComponent Component={ListRow} data={actionItems} showNoDataAvailable={false} navigate={navigate} />
          </Box>
        </Grid>
      </Grid>

      {/* Recent requests + bookings */}
      <Grid container spacing={{ xs: 1.5, md: 2.5 }}>
        <Grid item xs={12} sm={6} md={6}>
          <Box sx={CARD_SX}>
            <SectionHeader label="Recent Requests" title="Last 24 hours" onViewAll={() => navigate('/requests')} />
            <MapComponent Component={ListRow} data={recentReqRows} showNoDataAvailable={false} navigate={navigate} />
          </Box>
        </Grid>
        <Grid item xs={12} sm={6} md={6}>
          <Box sx={CARD_SX}>
            <SectionHeader label="Recent Bookings" title="Confirmed this week" onViewAll={() => navigate('/bookings')} />
            <MapComponent Component={DateTileRow} data={recentBkRows} showNoDataAvailable={false} navigate={navigate} />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
