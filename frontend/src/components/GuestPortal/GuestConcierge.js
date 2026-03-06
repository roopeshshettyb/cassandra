import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Typography, TextField, IconButton, InputAdornment, CircularProgress } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import MicIcon from '@mui/icons-material/Mic';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import SendIcon from '@mui/icons-material/Send';
import { io } from 'socket.io-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSocketVoice } from '../AvatarChatbot/hooks/useSocketVoice';
import constants from '../../constants.json';
import { NAVY, MUTED } from '../../theme';

const { APP_NAME } = constants;
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
            background: '#fff',
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

// ── Thinking dots ──────────────────────────────────────────────────────────
function ThinkingDots() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff' }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.15, 0.8] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.22 }}
        />
      ))}
    </Box>
  );
}

// ── Chat bubble renderer ───────────────────────────────────────────────────
function ChatBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <Box
      sx={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '82%',
        px: 2,
        py: 1.25,
        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        bgcolor: isUser ? NAVY : '#fff',
        color: isUser ? '#fff' : '#1B2340',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        '& p': { m: 0 },
        '& ul, & ol': { m: 0, pl: 2 },
        '& li': { mt: 0.4 },
        '& a': { color: 'inherit' },
        '& code': { fontFamily: 'monospace', fontSize: 12 },
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || ''}</ReactMarkdown>
    </Box>
  );
}

// ── Text Chat panel ────────────────────────────────────────────────────────
function TextChatPanel({ bookingId, isWithinStay, alertError }) {
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
        setMessages(payload.messages.map((m) => ({ id: m.id, role: m.role, content: m.content })));
        setTimeout(() => inputRef.current?.focus?.(), 100);
      }
    });
    socket.on('auth_required', () => socket.emit('auth', { token, bookingId }));
    socket.on('stream_chunk', (p) => setStreamingContent((prev) => prev + (p.content || '')));
    socket.on('stream_end', (p) => {
      setStreamingContent('');
      if (p.content) {
        setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: p.content }]);
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
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', content: text }]);
    setSending(true);
    setStreamingContent('');
    socketRef.current.emit('message', { content: text });
  }, [input, sending]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Messages */}
      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 2,
          py: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          bgcolor: '#F8F7F4',
        }}
      >
        {!ready && (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
            <CircularProgress size={24} sx={{ color: 'primary.main' }} />
          </Box>
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
              bgcolor: '#fff',
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
          px: 2,
          py: 1.5,
          borderTop: '1px solid rgba(0,0,0,0.07)',
          bgcolor: '#fff',
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
            endAdornment: (
              <InputAdornment position="end">
                {(sending || streamingContent) ? (
                  <CircularProgress size={16} sx={{ color: 'primary.main', mr: 0.5 }} />
                ) : (
                  <IconButton
                    onClick={handleSend}
                    disabled={!ready || sending || !input.trim()}
                    size="small"
                    sx={{ color: 'primary.main', '&.Mui-disabled': { color: 'rgba(0,0,0,0.26)' } }}
                  >
                    <SendIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                )}
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 3,
              bgcolor: '#F8F7F4',
              fontSize: 14,
            },
          }}
        />
      </Box>
    </Box>
  );
}

// ── Main GuestConcierge ────────────────────────────────────────────────────
export default function GuestConcierge({ booking, account, alertError, isWithinStay }) {
  const [showChat, setShowChat] = useState(false);

  const bookingId = booking?.id;
  const hotelName = booking?.hotel?.name || 'Hotel';

  const { isReady, isRecording, isSpeaking, isProcessing, startRecording, stopRecording } = useSocketVoice({
    bookingId,
    onError: (err) => alertError?.(err),
  });

  // When text chat opens, push a history entry so the top-right back arrow returns to voice view
  useEffect(() => {
    if (!showChat) return;
    window.history.pushState({ showChat: true }, '');
    const handlePopState = () => setShowChat(false);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showChat]);

  // Derive voice state directly from hook — no manual sync needed
  const voiceState = !isRecording ? 'idle'
    : isSpeaking    ? 'responding'
    : isProcessing  ? 'thinking'
    : 'listening';

  const handleMicTap = async () => {
    if (!isWithinStay) {
      alertError?.('Voice is only available during your stay.');
      return;
    }
    if (!isReady) {
      alertError?.('Voice connection not ready yet.');
      return;
    }
    if (voiceState === 'idle') {
      try {
        await startRecording();
      } catch (e) {
        alertError?.(e?.message || 'Could not start recording');
      }
    } else if (voiceState === 'listening') {
      stopRecording();
    }
    // thinking / responding: let it finish
  };

  const stateLabel = {
    idle: 'Tap to speak',
    listening: 'Listening…',
    thinking: 'Processing…',
    responding: 'Speaking…',
  }[voiceState];

  const isActive = voiceState !== 'idle';

  if (showChat) {
    return (
      <Box sx={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', bgcolor: '#F8F7F4' }}>
        <TextChatPanel bookingId={bookingId} isWithinStay={isWithinStay} alertError={alertError} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: 'calc(100vh - 80px)',
        bgcolor: '#F8F7F4',
        display: 'flex',
        flexDirection: 'column',
        px: 2.5,
        pt: 3,
        pb: 2,
      }}
    >
      <Box sx={{ maxWidth: 640, mx: 'auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'primary.main',
                mb: 1,
              }}
            >
              {hotelName}
            </Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 700, color: NAVY }}>Your Concierge</Typography>
            <Typography sx={{ fontSize: 14, color: MUTED, mt: 0.5 }}>How may I assist you?</Typography>
          </Box>
        </motion.div>

        {/* Voice button — centered */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            mt: -2,
          }}
        >
          <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Outer pulse rings (active) */}
            <AnimatePresence>
              {isActive && (
                <>
                  <motion.div
                    key="ring1"
                    style={{
                      position: 'absolute',
                      width: 160,
                      height: 160,
                      borderRadius: '50%',
                      background: isActive ? 'linear-gradient(135deg, rgba(212,175,55,0.25), rgba(197,160,34,0.1))' : 'transparent',
                    }}
                    initial={{ scale: 1, opacity: 0.3 }}
                    animate={{ scale: 1.7, opacity: 0 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                  />
                  <motion.div
                    key="ring2"
                    style={{
                      position: 'absolute',
                      width: 160,
                      height: 160,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(197,160,34,0.05))',
                    }}
                    initial={{ scale: 1, opacity: 0.2 }}
                    animate={{ scale: 1.45, opacity: 0 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
                  />
                </>
              )}
            </AnimatePresence>

            {/* Glow / halo ring */}
            <motion.div
              style={{
                position: 'absolute',
                width: 184,
                height: 184,
                borderRadius: '50%',
                border: '2px solid',
                borderColor: isActive ? '#D4AF37' : 'rgba(212,175,55,0.25)',
              }}
              animate={!isActive ? { scale: [1, 1.04, 1], opacity: [0.35, 0.65, 0.35] } : { scale: 1, opacity: 0.85 }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Main mic button */}
            <motion.button
              onClick={handleMicTap}
              style={{
                position: 'relative',
                zIndex: 1,
                width: 148,
                height: 148,
                borderRadius: '50%',
                border: 'none',
                cursor: isWithinStay ? 'pointer' : 'not-allowed',
                background: isActive ? 'linear-gradient(135deg, #D4AF37 0%, #C5A022 100%)' : NAVY,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isActive ? '0 8px 30px rgba(197,160,34,0.4)' : '0 8px 30px rgba(27,35,64,0.3)',
                outline: 'none',
              }}
              whileTap={{ scale: 0.94 }}
              animate={!isActive ? { scale: [1, 1.025, 1] } : {}}
              transition={!isActive ? { duration: 4, repeat: Infinity, ease: 'easeInOut' } : {}}
            >
              <AnimatePresence mode="wait">
                {voiceState === 'listening' ? (
                  <motion.div key="waveform" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ duration: 0.2 }}>
                    <WaveformBars />
                  </motion.div>
                ) : voiceState === 'thinking' ? (
                  <motion.div key="thinking" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ duration: 0.2 }}>
                    <ThinkingDots />
                  </motion.div>
                ) : (
                  <motion.div key="mic" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ duration: 0.2 }}>
                    <MicIcon sx={{ fontSize: 48, color: '#fff' }} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </Box>

          {/* State label */}
          <AnimatePresence mode="wait">
            <motion.div key={stateLabel} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <Typography
                sx={{
                  fontSize: 14,
                  color: MUTED,
                  letterSpacing: '0.04em',
                  textAlign: 'center',
                  fontWeight: 500,
                }}
              >
                {isWithinStay ? stateLabel : 'Available during your stay'}
              </Typography>
            </motion.div>
          </AnimatePresence>
        </Box>

        {/* Prefer to type? */}
        <Box sx={{ pb: 3, textAlign: 'center' }}>
          <motion.button
            onClick={() => setShowChat(true)}
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
