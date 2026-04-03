import React, { useState, useCallback } from 'react';
import { Avatar, Box, Typography, TextField, IconButton } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import request from '../../helper/api';
import { BRAND_GRADIENT, NAVY, MUTED, BORDER, BG, SHADOW, SHADOW_BRAND, TEXT_MUTED_DARK, HOVER_BG, STATUS_WARNING_BG, BACKDROP_BG } from '../../theme';
import { REQUEST_STATUS, REQUEST_TYPE_LABEL } from '../../constants/requestConfig';
import constants from '../../constants.json';

dayjs.extend(relativeTime);

const { HOTEL_STAFF, HOTEL_OWNER } = constants.ACCOUNT_ROLES;

const allCategories = [
  { value: 'all', label: 'All' },
  { value: 'room_service', label: 'Room Service' },
  { value: 'house_keeping', label: 'Housekeeping' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'airport_transfer', label: 'Airport Transfer' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function NoteThread({ userNotes, staffNotes, limit }) {
  let notes = [
    ...(Array.isArray(userNotes) ? userNotes.map((n) => ({ ...n, from: 'guest' })) : []),
    ...(Array.isArray(staffNotes) ? staffNotes.map((n) => ({ ...n, from: 'staff' })) : []),
  ].sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt));

  if (limit !== undefined) notes = notes.slice(-limit);

  if (notes.length === 0) return null;

  return (
    <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {notes.map((note, i) => {
        const isGuest = note.from === 'guest';
        return (
          <Box key={i} sx={{ display: 'flex', flexDirection: 'column', alignItems: isGuest ? 'flex-end' : 'flex-start' }}>
            <Box
              sx={{
                px: 1.5,
                py: 0.9,
                borderRadius: isGuest ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                bgcolor: isGuest ? STATUS_WARNING_BG : HOVER_BG,
                maxWidth: '88%',
              }}
            >
              <Typography sx={{ fontSize: 12, color: '#333', lineHeight: 1.5 }}>{note.text}</Typography>
            </Box>
            <Typography sx={{ fontSize: 10, color: MUTED, mt: 0.3, px: 0.5 }}>
              {isGuest ? 'You' : 'Hotel'} · {note.addedAt ? dayjs(note.addedAt).fromNow() : ''}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

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

// ── List row ──────────────────────────────────────────────────────────────────
function RequestRow({ req, index, onClick }) {
  const title = REQUEST_TYPE_LABEL[req.requestType] || req.requestType || 'Request';

  // Latest 2 user + 2 staff notes merged
  const userNotes = Array.isArray(req.userNotes) ? req.userNotes.slice(-2) : [];
  const staffNotes = Array.isArray(req.staffNotes) ? req.staffNotes.slice(-2) : [];

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
          '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.1)' },
          transition: 'box-shadow 0.2s',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, color: NAVY, lineHeight: 1.3, flex: 1, mr: 1.5 }}>{title}</Typography>
          <StatusBadge status={req.status} />
        </Box>

        <NoteThread userNotes={userNotes} staffNotes={staffNotes} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.5 }}>
          <Typography sx={{ fontSize: 11, color: MUTED }}>{dayjs(req.createdAt).fromNow()}</Typography>
          {req.urgency && (
            <>
              <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: BACKDROP_BG }} />
              <Typography sx={{ fontSize: 11, color: req.urgency === 'high' ? '#DC2626' : req.urgency === 'medium' ? '#D97706' : '#059669', fontWeight: 600, textTransform: 'capitalize' }}>
                {req.urgency} priority
              </Typography>
            </>
          )}
        </Box>
      </Box>
    </motion.div>
  );
}

// ── Detail view ───────────────────────────────────────────────────────────────
function RequestDetail({ req, account, onBack, alertError, alertSuccess, onUpdate }) {
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const title = REQUEST_TYPE_LABEL[req.requestType] || req.requestType || 'Request';
  const isStaff = account?.role === HOTEL_STAFF || account?.role === HOTEL_OWNER;

  const handleSendMessage = useCallback(async () => {
    const text = messageText.trim();
    if (!text) return;
    setSending(true);
    const result = await request({
      endpoint: `/requests/${req.id}/append-message`,
      method: 'POST',
      data: { message: text },
      alertError,
    });
    setSending(false);
    if (result?.data) {
      setMessageText('');
      onUpdate(result.data);
      alertSuccess?.('Message sent');
    }
  }, [messageText, req.id, alertError, alertSuccess, onUpdate]);

  const handleStatusChange = useCallback(async (newStatus) => {
    setUpdatingStatus(true);
    const result = await request({
      endpoint: `/requests/${req.id}`,
      method: 'PATCH',
      data: { status: newStatus },
      alertError,
    });
    setUpdatingStatus(false);
    if (result?.data) {
      onUpdate(result.data);
      alertSuccess?.('Status updated');
    }
  }, [req.id, alertError, alertSuccess, onUpdate]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ px: 2.5, pt: 3, pb: 2, borderBottom: `1px solid ${BORDER}`, bgcolor: 'background.default', position: 'sticky', top: 0, zIndex: 10 }}>
        <Box sx={{ maxWidth: 640, mx: 'auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <IconButton onClick={onBack} size="small" sx={{ color: NAVY }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography sx={{ fontWeight: 700, fontSize: 18, color: NAVY, flex: 1 }}>{title}</Typography>
            <StatusBadge status={req.status} />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography sx={{ fontSize: 11, color: MUTED }}>{dayjs(req.createdAt).fromNow()}</Typography>
            {req.urgency && (
              <>
                <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: BACKDROP_BG }} />
                <Typography sx={{ fontSize: 11, color: req.urgency === 'high' ? '#DC2626' : req.urgency === 'medium' ? '#D97706' : '#059669', fontWeight: 600, textTransform: 'capitalize' }}>
                  {req.urgency} priority
                </Typography>
              </>
            )}
          </Box>

          {/* Status change — staff/owner only */}
          {isStaff && (
            <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
              {STATUS_OPTIONS.map((opt) => {
                const isActive = req.status === opt.value;
                return (
                  <motion.button
                    key={opt.value}
                    onClick={() => !isActive && !updatingStatus && handleStatusChange(opt.value)}
                    whileTap={{ scale: 0.96 }}
                    style={{
                      padding: '5px 14px',
                      borderRadius: 99,
                      border: isActive ? 'none' : `1.5px solid ${BORDER}`,
                      background: isActive ? BRAND_GRADIENT : 'transparent',
                      cursor: isActive || updatingStatus ? 'default' : 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      color: isActive ? '#fff' : MUTED,
                      outline: 'none',
                      boxShadow: isActive ? SHADOW_BRAND : 'none',
                      opacity: updatingStatus ? 0.6 : 1,
                    }}
                  >
                    {opt.label}
                  </motion.button>
                );
              })}
            </Box>
          )}
        </Box>
      </Box>

      {/* Full note thread */}
      <Box sx={{ flex: 1, px: 2.5, py: 2, overflowY: 'auto' }}>
        <Box sx={{ maxWidth: 640, mx: 'auto' }}>
          {(req.userNotes?.length || req.staffNotes?.length) ? (
            <NoteThread userNotes={req.userNotes} staffNotes={req.staffNotes} />
          ) : (
            <Typography sx={{ fontSize: 13, color: MUTED, textAlign: 'center', pt: 6 }}>No messages yet</Typography>
          )}
        </Box>
      </Box>

      {/* Add message input */}
      <Box sx={{ px: 2.5, py: 2, borderTop: `1px solid ${BORDER}`, bgcolor: 'background.paper', flexShrink: 0 }}>
        <Box sx={{ maxWidth: 640, mx: 'auto', display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Add a message…"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
            }}
            multiline
            maxRows={4}
            disabled={sending}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: 'background.default', fontSize: 14 } }}
          />
          <IconButton
            onClick={handleSendMessage}
            disabled={!messageText.trim() || sending}
            sx={{ color: 'primary.main', '&.Mui-disabled': { opacity: 0.4 }, flexShrink: 0 }}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function GuestRequests({ booking, account, alertError, alertSuccess, setLoading, initialRequestId, logoUrl }) {
  const [filter, setFilter] = useState('all');
  const [requests, setRequests] = useState(() => Array.isArray(booking?.requests) ? booking.requests : []);
  const [selectedReq, setSelectedReq] = useState(() => {
    if (!initialRequestId) return null;
    return (booking?.requests || []).find((r) => r.id === initialRequestId) || null;
  });

  const hotelName = booking?.hotel?.name || 'Hotel';

  const filteredRequests = [...requests]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .filter((r) => filter === 'all' || r.requestType === filter);

  const availableCategories = allCategories.filter(
    (cat) => cat.value === 'all' || requests.some((r) => r.requestType === cat.value)
  );

  const handleUpdate = useCallback((updated) => {
    setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setSelectedReq(updated);
  }, []);

  if (selectedReq) {
    // Find the latest version from state
    const current = requests.find((r) => r.id === selectedReq.id) || selectedReq;
    return (
      <RequestDetail
        req={current}
        account={account}
        onBack={() => setSelectedReq(null)}
        alertError={alertError}
        alertSuccess={alertSuccess}
        onUpdate={handleUpdate}
      />
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', px: 2.5, pt: 3, pb: 14 }}>
      <Box sx={{ maxWidth: 640, mx: 'auto' }}>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Avatar
              src={logoUrl || undefined}
              sx={{ width: 32, height: 32, background: BRAND_GRADIENT, fontSize: 13, fontWeight: 700, color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
            >
              {!logoUrl && hotelName[0]?.toUpperCase()}
            </Avatar>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'primary.main' }}>
              {hotelName}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 24, fontWeight: 700, color: NAVY }}>Your Requests</Typography>
          <Typography sx={{ fontSize: 13, color: MUTED, mt: 0.5 }}>
            {filteredRequests.length} request{filteredRequests.length !== 1 ? 's' : ''}
          </Typography>
        </motion.div>

        {/* Filter chips */}
        {availableCategories.length > 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} style={{ marginTop: 20 }}>
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                overflowX: 'auto',
                pb: 0.5,
                mx: -0.5,
                px: 0.5,
                '&::-webkit-scrollbar': { display: 'none' },
                scrollbarWidth: 'none',
              }}
            >
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
                      color: isActive ? '#fff' : MUTED,
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
              <RequestRow key={req.id} req={req} index={i} onClick={() => setSelectedReq(req)} />
            ))}
          </AnimatePresence>
        </Box>

        {filteredRequests.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <Box sx={{ textAlign: 'center', py: 10 }}>
              <Typography sx={{ color: MUTED, fontSize: 15, fontWeight: 500 }}>No requests found</Typography>
              <Typography sx={{ fontSize: 13, color: TEXT_MUTED_DARK, mt: 0.75 }}>
                {filter !== 'all' ? 'Try a different category' : 'Speak to your concierge to get started'}
              </Typography>
            </Box>
          </motion.div>
        )}
      </Box>
    </Box>
  );
}
