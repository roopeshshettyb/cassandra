import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, TextField, IconButton, Avatar } from '@mui/material';
import { motion } from 'framer-motion';
import SendIcon from '@mui/icons-material/Send';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import HotelIcon from '@mui/icons-material/Hotel';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import request from '../helper/api';
import { BRAND_GRADIENT, NAVY, MUTED, BORDER, SHADOW, SHADOW_BRAND, STATUS_WARNING_BG, HOVER_BG, PRIMARY_CONTRAST, STATUS_ERROR, STATUS_WARNING, STATUS_SUCCESS } from '../theme';
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
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 1, opacity: 0.5 }}>
      <Typography sx={{ fontSize: 13, color: MUTED }}>No messages yet</Typography>
      <Typography sx={{ fontSize: 11, color: MUTED }}>Start the conversation below</Typography>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {notes.map((note, i) => {
        const isGuest = note.from === 'guest';
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: isGuest ? 'flex-end' : 'flex-start' }}>
              <Box sx={{
                px: 2,
                py: 1.1,
                borderRadius: isGuest ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: isGuest ? BRAND_GRADIENT : 'background.paper',
                bgcolor: isGuest ? undefined : 'background.paper',
                boxShadow: SHADOW,
                maxWidth: '75%',
                border: isGuest ? 'none' : `1px solid ${BORDER}`,
              }}>
                <Typography sx={{ fontSize: 13, color: isGuest ? PRIMARY_CONTRAST : 'text.primary', lineHeight: 1.55, fontWeight: 450 }}>
                  {note.text}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 10, color: MUTED, mt: 0.4, px: 0.5 }}>
                {isGuest ? 'Guest' : 'Hotel'} · {note.addedAt ? dayjs(note.addedAt).fromNow() : ''}
              </Typography>
            </Box>
          </motion.div>
        );
      })}
    </Box>
  );
}

function StatusBadge({ status }) {
  const st = REQUEST_STATUS[status] || REQUEST_STATUS.pending;
  const StatusIcon = st.icon;
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.6, borderRadius: 99, bgcolor: st.bg }}>
      <motion.div animate={st.spin ? { rotate: 360 } : {}} transition={st.spin ? { duration: 1.5, repeat: Infinity, ease: 'linear' } : {}} style={{ display: 'flex', alignItems: 'center' }}>
        <StatusIcon sx={{ fontSize: 11, color: st.color }} />
      </motion.div>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: st.color }}>{st.label}</Typography>
    </Box>
  );
}

export default function RequestDetails({ navigate, account, alertError, alertSuccess, setLoading, sidebarOpen, isMobile }) {
  const { id } = useParams();
  const [req, setReq] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    request({ endpoint: `/requests/${id}`, method: 'GET', setLoading, setData: setReq, defaultData: null, alertError });
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Auto-scroll messages to bottom
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [req]);

  const isStaff = account?.role === HOTEL_STAFF || account?.role === HOTEL_OWNER || account?.role === constants.ACCOUNT_ROLES.ADMIN;

  const handleSendMessage = async () => {
    const text = messageText.trim();
    if (!text || !req) return;
    setSending(true);
    const result = await request({ endpoint: `/requests/${req.id}/append-message`, method: 'POST', data: { message: text }, alertError });
    setSending(false);
    if (result?.data) { setMessageText(''); setReq(prev => ({ ...prev, ...result.data })); alertSuccess?.('Message sent'); inputRef.current?.focus?.(); }
  };

  const handleStatusChange = async (newStatus) => {
    if (!req) return;
    setUpdatingStatus(true);
    const result = await request({ endpoint: `/requests/${req.id}`, method: 'PATCH', data: { status: newStatus }, alertError });
    setUpdatingStatus(false);
    if (result?.data) { setReq(prev => ({ ...prev, ...result.data })); alertSuccess?.('Status updated'); }
  };

  if (!req) return null;

  const title = REQUEST_TYPE_LABEL[req.requestType] || req.requestType || 'Request';
  const initials = req.guest?.name?.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

  // ── Mobile layout (unchanged behaviour) ─────────────────────────────────
  if (isMobile) {
    return (
      <Box sx={{ position: 'fixed', top: 'var(--app-header-height)', left: 0, right: 0, bottom: 0, bgcolor: 'background.default', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Mobile Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <Box sx={{ px: 2, pt: '1svh', pb: 1.5, borderBottom: `1px solid ${BORDER}`, bgcolor: 'background.default', flexShrink: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'primary.main' }}>Request</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: 18, color: NAVY }}>{title}</Typography>
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
                    <motion.button key={opt.value} onClick={() => !isActive && !updatingStatus && handleStatusChange(opt.value)} whileTap={{ scale: 0.96 }}
                      style={{ padding: '5px 14px', borderRadius: 99, border: isActive ? 'none' : `1.5px solid ${BORDER}`, background: isActive ? BRAND_GRADIENT : 'transparent', cursor: isActive || updatingStatus ? 'default' : 'pointer', fontSize: 12, fontWeight: 600, color: isActive ? PRIMARY_CONTRAST : MUTED, outline: 'none', boxShadow: isActive ? SHADOW_BRAND : 'none', opacity: updatingStatus ? 0.6 : 1 }}>
                      {opt.label}
                    </motion.button>
                  );
                })}
              </Box>
            )}
          </Box>
        </motion.div>
        <Box ref={scrollRef} sx={{ flex: 1, px: 2, py: 2, overflowY: 'auto' }}>
          <NoteThread userNotes={req.userNotes} staffNotes={req.staffNotes} />
        </Box>
        <Box sx={{ px: 2, py: 1.5, borderTop: `1px solid ${BORDER}`, bgcolor: 'background.paper', flexShrink: 0 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
            <TextField inputRef={inputRef} fullWidth size="small" placeholder="Add a message…" value={messageText} onChange={(e) => setMessageText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} multiline maxRows={4} disabled={sending} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: 'background.default', fontSize: 14 } }} />
            <IconButton onClick={handleSendMessage} disabled={!messageText.trim() || sending} sx={{ color: 'primary.main', '&.Mui-disabled': { opacity: 0.4 }, flexShrink: 0 }}>
              <SendIcon />
            </IconButton>
          </Box>
        </Box>
      </Box>
    );
  }

  // ── Desktop layout ───────────────────────────────────────────────────────
  return (
    <Box sx={{
      position: 'fixed',
      top: '4svh',
      left: '20vw',
      right: 0,
      bottom: 0,
      bgcolor: 'background.default',
      display: 'flex',
      p: 3,
      gap: 3,
      overflow: 'hidden',
    }}>

      {/* ── Left Info Panel ─────────────────────────────── */}
      <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>

        {/* Guest avatar + name card */}
        <Box sx={{ bgcolor: 'background.paper', borderRadius: 3, p: 2.5, boxShadow: SHADOW, border: `1px solid ${BORDER}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Avatar sx={{ width: 44, height: 44, background: BRAND_GRADIENT, fontSize: 15, fontWeight: 700, color: PRIMARY_CONTRAST, boxShadow: SHADOW }}>
              {initials}
            </Avatar>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 14, color: NAVY, lineHeight: 1.2 }}>{req.guest?.name || 'Guest'}</Typography>
              <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.2 }}>Guest</Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
            {req.hotel?.name && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HotelIcon sx={{ fontSize: 14, color: MUTED }} />
                <Typography sx={{ fontSize: 12, color: MUTED }}>{req.hotel.name}</Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTimeIcon sx={{ fontSize: 14, color: MUTED }} />
              <Typography sx={{ fontSize: 12, color: MUTED }}>{dayjs(req.createdAt).fromNow()}</Typography>
            </Box>
            {req.urgency && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: req.urgency === 'high' ? STATUS_ERROR : req.urgency === 'medium' ? STATUS_WARNING : STATUS_SUCCESS, flexShrink: 0 }} />
                <Typography sx={{ fontSize: 12, color: req.urgency === 'high' ? STATUS_ERROR : req.urgency === 'medium' ? STATUS_WARNING : STATUS_SUCCESS, fontWeight: 600, textTransform: 'capitalize' }}>
                  {req.urgency} priority
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Status card */}
        <Box sx={{ bgcolor: 'background.paper', borderRadius: 3, p: 2.5, boxShadow: SHADOW, border: `1px solid ${BORDER}` }}>
          <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED, mb: 1.5 }}>Status</Typography>
          <Box sx={{ mb: 1.5 }}><StatusBadge status={req.status} /></Box>
          {isStaff && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {STATUS_OPTIONS.map((opt) => {
                const isActive = req.status === opt.value;
                return (
                  <motion.button
                    key={opt.value}
                    onClick={() => !isActive && !updatingStatus && handleStatusChange(opt.value)}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 8,
                      border: isActive ? 'none' : `1.5px solid ${BORDER}`,
                      background: isActive ? BRAND_GRADIENT : 'transparent',
                      cursor: isActive || updatingStatus ? 'default' : 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      color: isActive ? PRIMARY_CONTRAST : MUTED,
                      outline: 'none',
                      boxShadow: isActive ? SHADOW_BRAND : 'none',
                      opacity: updatingStatus ? 0.6 : 1,
                      textAlign: 'left',
                      width: '100%',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    {opt.label}
                  </motion.button>
                );
              })}
            </Box>
          )}
        </Box>
      </motion.div>

      {/* ── Right Chat Panel ─────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }} style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'background.paper', borderRadius: 3, boxShadow: SHADOW, border: `1px solid ${BORDER}`, overflow: 'hidden', minHeight: 0 }}>

          {/* Chat header */}
          <Box sx={{ px: 3, py: 2, borderBottom: `1px solid ${BORDER}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'primary.main', mb: 0.2 }}>Request</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 18, color: NAVY, lineHeight: 1.2 }}>{title}</Typography>
            </Box>
            <StatusBadge status={req.status} />
          </Box>

          {/* Messages */}
          <Box ref={scrollRef} sx={{ flex: 1, px: 3, py: 2.5, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0, minHeight: 0 }}>
            <NoteThread userNotes={req.userNotes} staffNotes={req.staffNotes} />
          </Box>

          {/* Input */}
          <Box sx={{ px: 3, py: 2, borderTop: `1px solid ${BORDER}`, flexShrink: 0, bgcolor: 'background.default' }}>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-end' }}>
              <TextField
                inputRef={inputRef}
                fullWidth
                size="small"
                placeholder="Add a message…"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                multiline
                maxRows={4}
                disabled={sending}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5, bgcolor: 'background.paper', fontSize: 14 } }}
              />
              <IconButton
                onClick={handleSendMessage}
                disabled={!messageText.trim() || sending}
                sx={{
                  width: 40,
                  height: 40,
                  background: !messageText.trim() || sending ? undefined : BRAND_GRADIENT,
                  color: !messageText.trim() || sending ? MUTED : PRIMARY_CONTRAST,
                  borderRadius: 2,
                  flexShrink: 0,
                  boxShadow: !messageText.trim() || sending ? 'none' : SHADOW_BRAND,
                  transition: 'all 0.2s',
                  '&.Mui-disabled': { opacity: 0.4 },
                }}
              >
                <SendIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          </Box>
        </Box>
      </motion.div>
    </Box>
  );
}
