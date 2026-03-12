import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Typography, TextField, IconButton, InputAdornment, CircularProgress } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import MicIcon from '@mui/icons-material/Mic';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import SendIcon from '@mui/icons-material/Send';
import { io } from 'socket.io-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSearchParams } from 'react-router-dom';
import { useSocketVoice } from '../AvatarChatbot/hooks/useSocketVoice';
import constants from '../../constants.json';
import { NAVY, MUTED, BRAND_GRADIENT, PRIMARY_CONTRAST } from '../../theme';

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
        bgcolor: isUser ? 'primary.main' : '#fff',
        color: isUser ? PRIMARY_CONTRAST : '#1B2340',
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
function TextChatPanel({ bookingId, isWithinStay, alertError, onSwitchToVoice }) {
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
            startAdornment: (
              <InputAdornment position="start">
                <IconButton
                  onClick={onSwitchToVoice}
                  size="small"
                  sx={{ color: MUTED, '&:hover': { color: NAVY } }}
                  title="Switch to voice"
                >
                  <MicIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={handleSend}
                  disabled={!ready || sending || !input.trim()}
                  size="small"
                  sx={{ color: 'primary.main', '&.Mui-disabled': { color: 'rgba(0,0,0,0.26)' } }}
                >
                  <SendIcon sx={{ fontSize: 18 }} />
                </IconButton>
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
export default function GuestConcierge({ booking, alertError, isWithinStay, isMobile }) {
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
      <Box sx={{ height: isMobile ? 'calc(95vh - 80px)' : 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', bgcolor: '#F8F7F4' }}>
        <TextChatPanel bookingId={bookingId} isWithinStay={isWithinStay} alertError={alertError} onSwitchToVoice={openVoice} />
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
          <motion.button
            onClick={handleMicTap}
            style={{
              width: 148,
              height: 148,
              borderRadius: '50%',
              border: 'none',
              cursor: isWithinStay ? 'pointer' : 'not-allowed',
              background: isRecording ? BRAND_GRADIENT : '#111',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isRecording ? '0 8px 30px rgba(197,160,34,0.4)' : '0 8px 30px rgba(0,0,0,0.25)',
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
                  <MicIcon sx={{ fontSize: 48, color: isRecording ? PRIMARY_CONTRAST : '#fff' }} />
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

        {/* Prefer to type? */}
        <Box sx={{ pb: 3, textAlign: 'center' }}>
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
