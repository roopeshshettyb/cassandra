import { useState, useRef, useEffect, useCallback } from 'react';
import { Avatar, Box, Typography, TextField, IconButton, InputAdornment, CircularProgress } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import MicIcon from '@mui/icons-material/Mic';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import SendIcon from '@mui/icons-material/Send';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import CloseIcon from '@mui/icons-material/Close';
import { io } from 'socket.io-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useSocketVoice } from '../AvatarChatbot/hooks/useSocketVoice';
import { NAVY, MUTED, BRAND_GRADIENT, PRIMARY_CONTRAST, BORDER, SHADOW, SHADOW_BRAND, NAVY_CONTRAST, HOVER_BG } from '../../theme';

dayjs.extend(relativeTime);

const getBackendUrl = () => (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');

// ── Waveform bars for listening state ──────────────────────────────────────
function WaveformBars() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, height: 28 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          style={{
            width: 4,
            height: 20,
            borderRadius: 99,
            background: NAVY_CONTRAST,
            originY: 0.5,
          }}
          animate={{ scaleY: [0.4, 1.5, 0.4] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.1,
            ease: 'easeInOut',
          }}
        />
      ))}
    </Box>
  );
}

// ── Chat bubble renderer ───────────────────────────────────────────────────
function ChatBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '75%',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.1,
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: isUser ? BRAND_GRADIENT : 'background.paper',
          bgcolor: isUser ? undefined : 'background.paper',
          border: isUser ? 'none' : `1px solid ${BORDER}`,
          boxShadow: SHADOW,
          color: isUser ? PRIMARY_CONTRAST : 'text.primary',
          '& p': { m: 0 },
          '& ul, & ol': { m: 0, pl: 2 },
          '& li': { mt: 0.4 },
          '& a': { color: 'inherit' },
          '& code': { fontFamily: 'monospace', fontSize: 12 },
        }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || ''}</ReactMarkdown>
      </Box>
      {message.createdAt && (
        <Typography sx={{ fontSize: 10, color: MUTED, alignSelf: isUser ? 'flex-end' : 'flex-start', px: 0.5 }}>
          {dayjs(message.createdAt).fromNow()}
        </Typography>
      )}
    </motion.div>
  );
}

// ── Text Chat panel ────────────────────────────────────────────────────────
function TextChatPanel({ bookingId, isWithinStay, alertError, onSwitchToVoice, hotelName }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const socketRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
  }, [messages, streamingContent]);

  useEffect(() => {
    if (!bookingId || !isWithinStay) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    const url = getBackendUrl();
    if (!url) return;

    const socket = io(`${url}/chat`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      query: { token, bookingId: String(bookingId) },
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on('ready', (payload) => {
      setReady(true);
      if (Array.isArray(payload?.messages)) {
        setMessages(payload.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt })));
        setTimeout(() => inputRef.current?.focus?.(), 100);
      }
    });
    socket.on('auth_required', () => socket.emit('auth', { token, bookingId }));
    socket.on('stream_chunk', (p) => setStreamingContent((prev) => prev + (p.content || '')));
    socket.on('stream_end', (p) => {
      setStreamingContent('');
      if (p.content) {
        setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: p.content, createdAt: new Date().toISOString() }]);
      }
      setSending(false);
      inputRef.current?.focus?.();
    });
    socket.on('error', (p) => {
      setStreamingContent('');
      setSending(false);
      alertError?.(p?.message || 'Something went wrong');
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [bookingId, isWithinStay, alertError]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || !socketRef.current?.connected || sending) return;
    setInput('');
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', content: text, createdAt: new Date().toISOString() }]);
    setSending(true);
    setStreamingContent('');
    socketRef.current.emit('message', { content: text });
  }, [input, sending]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Desktop Header */}
      <Box sx={{ px: 3, pt: 2, pb: 2, borderBottom: `1px solid ${BORDER}`, display: { xs: 'none', md: 'flex' }, alignItems: 'center', justifyContent: 'space-between', bgcolor: 'transparent', flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ width: 44, height: 44, background: BRAND_GRADIENT, color: PRIMARY_CONTRAST, boxShadow: SHADOW }}>
            <SupportAgentIcon sx={{ fontSize: 24 }} />
          </Avatar>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: NAVY, lineHeight: 1.2 }}>AI Concierge</Typography>
            <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.2 }}>{hotelName}</Typography>
          </Box>
        </Box>
        <IconButton onClick={onSwitchToVoice} size="small" sx={{ color: MUTED, '&:hover': { color: NAVY, bgcolor: HOVER_BG } }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Messages */}
      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: { xs: 2, md: 3 },
          pt: { xs: 1.5, md: 3 },
          pb: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          bgcolor: 'transparent',
          scrollBehavior: 'smooth',
          '&::-webkit-scrollbar': { display: 'none' },
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}
      >
        {!ready && (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
            <CircularProgress size={24} sx={{ color: 'primary.main' }} />
          </Box>
        )}
        
        {ready && messages.length <= 1 && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', py: { xs: 4, md: 8 }, px: 2 }}>
              <Box sx={{ position: 'relative', display: 'inline-block', mb: 4 }}>
                <Box sx={{ position: 'absolute', top: -30, left: -30, right: -30, bottom: -30, background: BRAND_GRADIENT, filter: 'blur(40px)', opacity: 0.15, borderRadius: '50%' }} />
                <Avatar sx={{ width: 80, height: 80, background: BRAND_GRADIENT, color: PRIMARY_CONTRAST, boxShadow: '0 12px 32px rgba(0,0,0,0.1)', position: 'relative', zIndex: 1, border: '2px solid rgba(255,255,255,0.8)' }}>
                  <SupportAgentIcon sx={{ fontSize: 40 }} />
                </Avatar>
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: { xs: 26, md: 32 }, mb: 1.5, color: NAVY }}>
                Hi! I'm your AI Concierge.
              </Typography>
              <Typography sx={{ fontSize: { xs: 14, md: 16 }, color: MUTED, maxWidth: 500, mx: 'auto', mb: 5, lineHeight: 1.6 }}>
                Experience {hotelName} effortlessly. I'm here 24/7 to manage your requests, provide local insights, and elevate your stay.
              </Typography>

              <Box sx={{ width: '100%', maxWidth: 700, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                {['Order room service', 'Request extra towels', 'Get dining recommendations', 'Arrange a late checkout'].map((prompt, i) => (
                  <motion.div key={i} whileHover={{ y: -4, boxShadow: SHADOW_HOVER }} transition={{ duration: 0.2 }}>
                    <Box
                      onClick={() => {
                         if (!sending && socketRef.current?.connected) {
                           setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', content: prompt, createdAt: new Date().toISOString() }]);
                           setSending(true);
                           setStreamingContent('');
                           socketRef.current.emit('message', { content: prompt });
                         }
                      }}
                      sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2.5, borderRadius: 3, bgcolor: 'background.paper', border: `1px solid ${BORDER}`, cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.2s', '&:hover': { borderColor: 'primary.main' } }}
                    >
                      <Box sx={{ p: 1, borderRadius: 2, bgcolor: HOVER_BG, color: 'primary.main', display: 'flex' }}>
                         <ChatBubbleOutlineIcon sx={{ fontSize: 20 }} />
                      </Box>
                      <Typography sx={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{prompt}</Typography>
                    </Box>
                  </motion.div>
                ))}
              </Box>
            </Box>
          </motion.div>
        )}

        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} />
        ))}
        {streamingContent && <ChatBubble message={{ role: 'assistant', content: streamingContent }} />}
        {!streamingContent && sending && (
          <Box
            sx={{
              alignSelf: 'flex-start',
              px: 2,
              py: 1.25,
              borderRadius: '18px 18px 18px 4px',
              bgcolor: 'background.paper',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <CircularProgress size={14} sx={{ color: 'primary.main' }} />
            <Typography sx={{ fontSize: 13, color: MUTED }}>Thinking…</Typography>
          </Box>
        )}
      </Box>

      {/* Input */}
      <Box
        sx={{
          px: { xs: 2, md: 3 },
          py: 2,
          borderTop: `1px solid ${BORDER}`,
          bgcolor: 'transparent',
          flexShrink: 0,
        }}
      >
        <TextField
          inputRef={inputRef}
          fullWidth
          size="small"
          placeholder={ready ? 'Type a message…' : 'Connecting…'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={!ready || sending}
          multiline
          maxRows={4}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                  <IconButton
                    onClick={onSwitchToVoice}
                    size="small"
                    sx={{ color: MUTED, '@media (hover: hover)': { '&:hover': { color: NAVY } } }}
                    title="Switch to voice"
                  >
                    <MicIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Box>
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={handleSend}
                  disabled={!ready || sending || !input.trim()}
                  size="small"
                  sx={{ 
                    width: { xs: 'auto', md: 40 },
                    height: { xs: 'auto', md: 40 },
                    background: { xs: 'none', md: (!input.trim() || sending) ? undefined : BRAND_GRADIENT },
                    color: { xs: 'primary.main', md: (!input.trim() || sending) ? MUTED : PRIMARY_CONTRAST },
                    borderRadius: { md: 2 },
                    boxShadow: { md: (!input.trim() || sending) ? 'none' : SHADOW_BRAND },
                    transition: 'all 0.2s',
                    '&.Mui-disabled': { opacity: { xs: 0.5, md: 0.4 } } 
                  }}
                >
                  <SendIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: { xs: 3, md: 2.5 },
              bgcolor: 'background.paper',
              fontSize: 14,
            },
          }}
        />
      </Box>
    </Box>
  );
}

// ── Main GuestConcierge ────────────────────────────────────────────────────
export default function GuestConcierge({ booking, alertError, isWithinStay, isMobile, logoUrl }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const showChat = searchParams.get('mode') === 'chat';

  const openChat = useCallback(() => setSearchParams({ tab: 'concierge', mode: 'chat' }), [setSearchParams]);
  const openVoice = useCallback(() => setSearchParams({ tab: 'concierge' }), [setSearchParams]);

  const bookingId = booking?.id;
  const hotelName = booking?.hotel?.name || 'Hotel';

  const { isReady, isRecording, startRecording, stopRecording } = useSocketVoice({
    bookingId: showChat ? null : bookingId,
    onError: (err) => alertError?.(err),
  });

  const handleMicTap = async () => {
    if (!isWithinStay) {
      alertError?.('Voice is only available during your stay.');
      return;
    }
    if (!isReady) {
      alertError?.('Voice connection not ready yet.');
      return;
    }
    if (isRecording) {
      stopRecording();
    } else {
      try {
        await startRecording();
      } catch (e) {
        alertError?.(e?.message || 'Could not start recording');
      }
    }
  };

  if (showChat) {
    return (
      <Box sx={{ height: '100%', display: 'flex', justifyContent: 'center', minHeight: 0 }}>
        <Box sx={{ width: '100%', maxWidth: { md: 900 }, height: '100%', display: 'flex', flexDirection: 'column', bgcolor: { xs: 'background.default', md: 'background.default' }, minHeight: 0, borderRadius: { md: 4 }, overflow: 'hidden', border: { md: `1px solid ${BORDER}` }, boxShadow: { md: '0 24px 48px rgba(0,0,0,0.06)' } }}>
          {/* Main Centered Text Chat Panel */}
          <TextChatPanel bookingId={bookingId} isWithinStay={isWithinStay} alertError={alertError} onSwitchToVoice={openVoice} hotelName={hotelName} />
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flex: isMobile ? 1 : 'unset',
        minHeight: isMobile ? 0 : '89dvh',
        height: isMobile ? 'unset' : '89dvh',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        px: 2.5,
        pt: { xs: 1, md: 0 },
        pb: 2,
        position: 'relative',
      }}
    >
      <Box sx={{ maxWidth: 640, mx: 'auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header — top */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
            <Avatar
              src={logoUrl || undefined}
              sx={{ width: 32, height: 32, background: BRAND_GRADIENT, fontSize: 13, fontWeight: 700, color: PRIMARY_CONTRAST, boxShadow: SHADOW }}
            >
              {!logoUrl && hotelName[0]?.toUpperCase()}
            </Avatar>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'primary.main' }}>
              {hotelName}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 22, fontWeight: 700, color: NAVY }}>Your Concierge</Typography>
          <Typography sx={{ fontSize: 14, color: MUTED, mt: 0.5 }}>How may I assist you?</Typography>
        </motion.div>

        {/* Voice button — flex:1 centers mic in remaining space, pb clears Prefer to type */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, pb: '10svh' }}>
          <motion.button
            onClick={handleMicTap}
            style={{
              width: 148,
              height: 148,
              borderRadius: '50%',
              border: 'none',
              cursor: isWithinStay ? 'pointer' : 'not-allowed',
              background: isRecording ? BRAND_GRADIENT : NAVY,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isRecording ? SHADOW_BRAND : SHADOW,
              outline: 'none',
            }}
            whileTap={{ scale: 0.94 }}
          >
            <AnimatePresence mode="wait">
              {isRecording ? (
                <motion.div key="waveform" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ duration: 0.2 }}>
                  <WaveformBars />
                </motion.div>
              ) : (
                <motion.div key="mic" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ duration: 0.2 }}>
                  <MicIcon sx={{ fontSize: 48, color: NAVY_CONTRAST }} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          <Typography
            sx={{
              fontSize: 14,
              color: MUTED,
              letterSpacing: '0.04em',
              textAlign: 'center',
              fontWeight: 500,
            }}
          >
            {!isWithinStay ? 'Available during your stay' : isRecording ? 'Tap to stop' : 'Tap to speak'}
          </Typography>
        </Box>

        {/* Prefer to type? — fixed to bottom 10% */}
        <Box sx={{ position: 'absolute', bottom: '10%', left: 0, right: 0, textAlign: 'center' }}>
          <motion.button
            onClick={openChat}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: MUTED,
              fontSize: 14,
              fontWeight: 500,
              padding: '10px 16px',
            }}
            whileTap={{ scale: 0.97 }}
          >
            <ChatBubbleOutlineIcon sx={{ fontSize: 18, color: MUTED }} />
            Prefer to type?
          </motion.button>
        </Box>
      </Box>
    </Box>
  );
}
