import React, { useState } from 'react';
import { Avatar, Box, Typography } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { BRAND_GRADIENT, NAVY, MUTED, BORDER, SHADOW, SHADOW_HOVER, SHADOW_BRAND, TEXT_MUTED_DARK, BACKDROP_BG, PRIMARY_CONTRAST } from '../../theme';
import { REQUEST_STATUS, REQUEST_TYPE_LABEL, REQUEST_URGENCY } from '../../constants/requestConfig';

dayjs.extend(relativeTime);

const allCategories = [
  { value: 'all', label: 'All' },
  { value: 'room_service', label: 'Room Service' },
  { value: 'house_keeping', label: 'Housekeeping' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'airport_transfer', label: 'Airport Transfer' },
];

function StatusBadge({ status }) {
  const st = REQUEST_STATUS[status] || REQUEST_STATUS.pending;
  const StatusIcon = st.icon;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.5, borderRadius: 99, bgcolor: st.bg, flexShrink: 0 }}>
      <motion.div animate={st.spin ? { rotate: 360 } : {}} transition={st.spin ? { duration: 1.5, repeat: Infinity, ease: 'linear' } : {}} style={{ display: 'flex', alignItems: 'center' }}>
        <StatusIcon sx={{ fontSize: 12, color: st.color }} />
      </motion.div>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: st.color }}>{st.label}</Typography>
    </Box>
  );
}

function RequestRow({ req, index, onClick }) {
  const title = REQUEST_TYPE_LABEL[req.requestType] || req.requestType || 'Request';
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.06 }}>
      <Box
        onClick={onClick}
        sx={{
          p: 2,
          borderRadius: 3,
          bgcolor: 'background.paper',
          border: `1px solid ${BORDER}`,
          boxShadow: SHADOW,
          cursor: 'pointer',
          '@media (hover: hover)': { '&:hover': { boxShadow: SHADOW_HOVER } },
          transition: 'box-shadow 0.2s',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, color: NAVY, lineHeight: 1.3, flex: 1, mr: 1.5 }}>{title}</Typography>
          <StatusBadge status={req.status} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1 }}>
          <Typography sx={{ fontSize: 11, color: MUTED }}>{dayjs(req.createdAt).fromNow()}</Typography>
          {req.urgency && (
            <>
              <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: BACKDROP_BG }} />
              <Typography
                sx={{ fontSize: 11, color: (REQUEST_URGENCY[req.urgency] || REQUEST_URGENCY.low).color, fontWeight: 600, textTransform: 'capitalize' }}
              >
                {req.urgency} priority
              </Typography>
            </>
          )}
        </Box>
      </Box>
    </motion.div>
  );
}

export default function GuestRequests({ booking, alertError, setLoading, logoUrl, navigate }) {
  const [filter, setFilter] = useState('all');

  const hotelName = booking?.hotel?.name || 'Hotel';
  const requests = Array.isArray(booking?.requests) ? booking.requests : [];

  const filteredRequests = [...requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).filter((r) => filter === 'all' || r.requestType === filter);

  const availableCategories = allCategories.filter((cat) => cat.value === 'all' || requests.some((r) => r.requestType === cat.value));

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', px: 2.5, pb: '18vh' }}>
      <Box sx={{ maxWidth: 640, mx: 'auto' }}>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Avatar src={logoUrl || undefined} sx={{ width: 32, height: 32, background: BRAND_GRADIENT, fontSize: 13, fontWeight: 700, color: PRIMARY_CONTRAST, boxShadow: SHADOW }}>
              {!logoUrl && hotelName[0]?.toUpperCase()}
            </Avatar>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'primary.main' }}>{hotelName}</Typography>
          </Box>
          <Typography sx={{ fontSize: 24, fontWeight: 700, color: NAVY }}>Your Requests</Typography>
          <Typography sx={{ fontSize: 13, color: MUTED, mt: 0.5 }}>
            {filteredRequests.length} request{filteredRequests.length !== 1 ? 's' : ''}
          </Typography>
        </motion.div>

        {/* Filter chips */}
        {availableCategories.length > 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} style={{ marginTop: 20 }}>
            <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5, mx: -0.5, px: 0.5, '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none' }}>
              {availableCategories.map((cat) => {
                const isActive = filter === cat.value;
                return (
                  <motion.button
                    key={cat.value}
                    onClick={() => setFilter(cat.value)}
                    whileTap={{ scale: 0.96 }}
                    style={{
                      padding: '7px 16px',
                      borderRadius: 99,
                      border: isActive ? 'none' : `1.5px solid ${BORDER}`,
                      background: isActive ? BRAND_GRADIENT : 'transparent',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      color: isActive ? PRIMARY_CONTRAST : MUTED,
                      whiteSpace: 'nowrap',
                      outline: 'none',
                      boxShadow: isActive ? SHADOW_BRAND : 'none',
                      transition: 'all 0.2s ease',
                      flexShrink: 0,
                    }}
                  >
                    {cat.label}
                  </motion.button>
                );
              })}
            </Box>
          </motion.div>
        )}

        {/* Request list */}
        <Box sx={{ mt: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <AnimatePresence>
            {filteredRequests.map((req, i) => (
              <RequestRow key={req.id} req={req} index={i} onClick={() => navigate(`/requests/${req.id}`)} />
            ))}
          </AnimatePresence>
        </Box>

        {filteredRequests.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <Box sx={{ textAlign: 'center', py: 10 }}>
              <Typography sx={{ color: MUTED, fontSize: 15, fontWeight: 500 }}>No requests found</Typography>
              <Typography sx={{ fontSize: 13, color: TEXT_MUTED_DARK, mt: 0.75 }}>{filter !== 'all' ? 'Try a different category' : 'Speak to your concierge to get started'}</Typography>
            </Box>
          </motion.div>
        )}
      </Box>
    </Box>
  );
}
