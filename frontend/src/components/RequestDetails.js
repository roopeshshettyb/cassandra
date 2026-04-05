import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, TextField, IconButton } from '@mui/material';
import { motion } from 'framer-motion';
import SendIcon from '@mui/icons-material/Send';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import request from '../helper/api';
import { BRAND_GRADIENT, NAVY, MUTED, BORDER, SHADOW, SHADOW_BRAND, STATUS_WARNING_BG, HOVER_BG, BACKDROP_BG, PRIMARY_CONTRAST, STATUS_ERROR, STATUS_WARNING, STATUS_SUCCESS } from '../theme';
import { REQUEST_STATUS, REQUEST_TYPE_LABEL } from '../constants/requestConfig';
import constants from '../constants.json';

dayjs.extend(relativeTime);

const { HOTEL_STAFF, HOTEL_OWNER } = constants.ACCOUNT_ROLES;

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function NoteThread({ userNotes, staffNotes }) {
  const notes = [
    ...(Array.isArray(userNotes) ? userNotes.map((n) => ({ ...n, from: 'guest' })) : []),
    ...(Array.isArray(staffNotes) ? staffNotes.map((n) => ({ ...n, from: 'staff' })) : []),
  ].sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt));

  if (notes.length === 0) return (
    <Typography sx={{ fontSize: 13, color: MUTED, textAlign: 'center', pt: 6 }}>No messages yet</Typography>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {notes.map((note, i) => {
        const isGuest = note.from === 'guest';
        return (
          <Box key={i} sx={{ display: 'flex', flexDirection: 'column', alignItems: isGuest ? 'flex-end' : 'flex-start' }}>
            <Box sx={{ px: 1.5, py: 0.9, borderRadius: isGuest ? '12px 12px 4px 12px' : '12px 12px 12px 4px', bgcolor: isGuest ? STATUS_WARNING_BG : HOVER_BG, maxWidth: '88%' }}>
              <Typography sx={{ fontSize: 12, color: 'text.primary', lineHeight: 1.5 }}>{note.text}</Typography>
            </Box>
            <Typography sx={{ fontSize: 10, color: MUTED, mt: 0.3, px: 0.5 }}>
              {isGuest ? 'Guest' : 'Hotel'} · {note.addedAt ? dayjs(note.addedAt).fromNow() : ''}
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

export default function RequestDetails({ navigate, account, alertError, alertSuccess, setLoading }) {
  const { id } = useParams();
  const [req, setReq] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    request({ endpoint: `/requests/${id}`, method: 'GET', setLoading, setData: setReq, defaultData: null, alertError });
    if (window.innerWidth < 768) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const isStaff = account?.role === HOTEL_STAFF || account?.role === HOTEL_OWNER || account?.role === constants.ACCOUNT_ROLES.ADMIN;

  const handleSendMessage = async () => {
    const text = messageText.trim();
    if (!text || !req) return;
    setSending(true);
    const result = await request({ endpoint: `/requests/${req.id}/append-message`, method: 'POST', data: { message: text }, alertError });
    setSending(false);
    if (result?.data) { setMessageText(''); setReq(result.data); alertSuccess?.('Message sent'); }
  };

  const handleStatusChange = async (newStatus) => {
    if (!req) return;
    setUpdatingStatus(true);
    const result = await request({ endpoint: `/requests/${req.id}`, method: 'PATCH', data: { status: newStatus }, alertError });
    setUpdatingStatus(false);
    if (result?.data) { setReq(result.data); alertSuccess?.('Status updated'); }
  };

  if (!req) return null;

  const title = REQUEST_TYPE_LABEL[req.requestType] || req.requestType || 'Request';

  return (
    <Box sx={{ position: { xs: 'fixed', md: 'relative' }, top: { xs: '10vh', md: 'unset' }, left: { xs: 0, md: 'unset' }, right: { xs: 0, md: 'unset' }, bottom: { xs: 0, md: 'unset' }, height: { xs: 'unset', md: '100dvh' }, bgcolor: 'background.default', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Box sx={{ px: { xs: 2, sm: 3 }, pt: { xs: '3vh', md: 0 }, pb: 2, borderBottom: `1px solid ${BORDER}`, bgcolor: 'background.default', flexShrink: 0  }}>
        <Box sx={{ maxWidth: 800, mx: 'auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'primary.main' }}>Request</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 20, color: NAVY }}>{title}</Typography>
            </Box>
            <StatusBadge status={req.status} />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            {req.guest?.name && <Typography sx={{ fontSize: 12, color: MUTED }}>{req.guest.name}</Typography>}
            {req.hotel?.name && <Typography sx={{ fontSize: 12, color: MUTED }}>{req.hotel.name}</Typography>}
            <Typography sx={{ fontSize: 11, color: MUTED }}>{dayjs(req.createdAt).fromNow()}</Typography>
            {req.urgency && (
              <Typography sx={{ fontSize: 11, color: req.urgency === 'high' ? STATUS_ERROR : req.urgency === 'medium' ? STATUS_WARNING : STATUS_SUCCESS, fontWeight: 600, textTransform: 'capitalize' }}>
                {req.urgency} priority
              </Typography>
            )}
          </Box>

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
                      color: isActive ? PRIMARY_CONTRAST : MUTED,
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
      </motion.div>

      {/* Messages */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.15 }} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flex: 1, px: { xs: 2, sm: 3 }, py: 2, overflowY: 'auto' }}>
        <Box sx={{ maxWidth: 800, mx: 'auto' }}>
          <NoteThread userNotes={req.userNotes} staffNotes={req.staffNotes} />
        </Box>
      </Box>
      </motion.div>

      {/* Input */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.2 }}>
      <Box sx={{ px: { xs: 2, sm: 3 }, py: 2, borderTop: `1px solid ${BORDER}`, bgcolor: 'background.paper', flexShrink: 0 }}>
        <Box sx={{ maxWidth: 800, mx: 'auto', display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Add a message…"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
            multiline
            maxRows={4}
            disabled={sending}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: 'background.default', fontSize: 14 } }}
          />
          <IconButton onClick={handleSendMessage} disabled={!messageText.trim() || sending} sx={{ color: 'primary.main', '&.Mui-disabled': { opacity: 0.4 }, flexShrink: 0 }}>
            <SendIcon />
          </IconButton>
        </Box>
      </Box>
      </motion.div>
    </Box>
  );
}
