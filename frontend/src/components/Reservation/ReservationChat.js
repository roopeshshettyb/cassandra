import { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Typography, TextField, IconButton, InputAdornment, CircularProgress, Avatar } from '@mui/material';
import { motion } from 'framer-motion';
import SendIcon from '@mui/icons-material/Send';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import { io } from 'socket.io-client';
import { NAVY, MUTED, BRAND_GRADIENT, PRIMARY_CONTRAST, BORDER } from '../../theme';
import constants from '../../constants.json';
import { sessionStorageKey, sessionAuth } from './reservationSession';
import ChatBubble from '../AvatarChatbot/ui/ChatBubble';
import { getBackendUrl, SuggestionStrip } from '../GuestPortal/GuestConcierge';
import MapComponent from '../MapComponent';

const MessageBubble = ({ data }) => <ChatBubble message={data} />;

/**
 * Chat for the public reservation agent, on the unauthenticated /reservation
 * namespace. It draws with the concierge's own pieces, so a message looks the
 * same wherever it is read.
 */
export default function ReservationChat({ hotelId, onHotelResolved, onFatalError, alertError }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  const socketRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Read through refs so the socket effect never needs to re-run: the route's
  // hotel id is fixed for the life of this page.
  const hotelIdRef = useRef(hotelId);
  const alertErrorRef = useRef(alertError);
  alertErrorRef.current = alertError;
  const onHotelResolvedRef = useRef(onHotelResolved);
  onHotelResolvedRef.current = onHotelResolved;
  const onFatalErrorRef = useRef(onFatalError);
  onFatalErrorRef.current = onFatalError;

  const storageKey = sessionStorageKey(hotelId);
  const storageKeyRef = useRef(storageKey);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  useEffect(() => {
    const url = getBackendUrl();
    if (!url) return undefined;

    const socket = io(`${url}/reservation`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      query: { hotelId: String(hotelIdRef.current) },
      auth: sessionAuth(storageKeyRef.current),
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    socket.on('ready', (payload) => {
      setReady(true);
      onHotelResolvedRef.current?.(payload?.hotel || null);
      if (payload?.sessionToken) {
        localStorage.setItem(storageKeyRef.current, payload.sessionToken);
      }
      const history = Array.isArray(payload?.messages) ? payload.messages : [];
      setMessages(history.map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt })));
      requestAnimationFrame(scrollToBottom);
      setTimeout(() => inputRef.current?.focus?.(), 100);
    });

    // The chat row is created on the first message, so its handle arrives here.
    socket.on('session', (payload) => {
      if (payload?.sessionToken) {
        localStorage.setItem(storageKeyRef.current, payload.sessionToken);
      }
    });

    socket.on('stream_chunk', (p) => {
      setStreamingContent((prev) => prev + (p.content || ''));
      requestAnimationFrame(scrollToBottom);
    });

    socket.on('stream_end', (p) => {
      if (p.content) {
        setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: p.content, createdAt: new Date().toISOString() }]);
        requestAnimationFrame(scrollToBottom);
      }
      setStreamingContent('');
      setSending(false);
      setTimeout(() => inputRef.current?.focus?.(), 0);
    });

    socket.on('error', (p) => {
      setStreamingContent('');
      setSending(false);
      onFatalErrorRef.current?.(p?.message);
      alertErrorRef.current?.(p?.message);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);

  const submit = useCallback((text) => {
    const content = text.trim();
    if (!content || sending || !socketRef.current?.connected) return;
    setInput('');
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', content, createdAt: new Date().toISOString() }]);
    requestAnimationFrame(scrollToBottom);
    setSending(true);
    setStreamingContent('');
    socketRef.current.emit('message', { content });
  }, [sending]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
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
          '&::-webkit-scrollbar': { display: 'none' },
          scrollbarWidth: 'none',
        }}
      >
        {!ready && (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
            <CircularProgress size={24} sx={{ color: 'primary.main' }} />
          </Box>
        )}

        {ready && messages.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', py: { xs: 3, md: '4vh' }, px: 2 }}>
              <Box sx={{ position: 'relative', display: 'inline-block', mb: 4 }}>
                <Box sx={{ position: 'absolute', top: -30, left: -30, right: -30, bottom: -30, background: BRAND_GRADIENT, filter: 'blur(40px)', opacity: 0.15, borderRadius: '50%' }} />
                <Avatar sx={{ width: 80, height: 80, background: BRAND_GRADIENT, color: PRIMARY_CONTRAST, boxShadow: '0 12px 32px rgba(0,0,0,0.1)', position: 'relative', zIndex: 1, border: '2px solid rgba(255,255,255,0.8)' }}>
                  <SupportAgentIcon sx={{ fontSize: 40 }} />
                </Avatar>
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: { xs: 26, md: 32 }, mb: 1.5, color: NAVY }}>
                {constants.RESERVATION_TITLE}
              </Typography>
              <Typography sx={{ fontSize: { xs: 14, md: 16 }, color: MUTED, maxWidth: 500, mx: 'auto', mb: 2, lineHeight: 1.6 }}>
                {constants.RESERVATION_SUBTITLE}
              </Typography>
            </Box>
          </motion.div>
        )}

        <MapComponent Component={MessageBubble} data={messages} showNoDataAvailable={false} />
        {sending && streamingContent && <ChatBubble message={{ role: 'assistant', content: streamingContent }} />}
        {sending && !streamingContent && (
          <Box sx={{ alignSelf: 'flex-start', px: 2, py: 1.25, borderRadius: '18px 18px 18px 4px', bgcolor: 'background.paper', display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={14} sx={{ color: 'primary.main' }} />
            <Typography sx={{ fontSize: 13, color: MUTED }}>Thinking…</Typography>
          </Box>
        )}
      </Box>

      {ready && !sending && (
        <Box sx={{ px: { xs: 2, md: 3 }, pt: 1.5, pb: 0.5, flexShrink: 0 }}>
          <SuggestionStrip items={constants.RESERVATION_SUGGESTIONS || []} onSelect={submit} disabled={sending} />
        </Box>
      )}

      <Box sx={{ px: { xs: 2, md: 3 }, py: 2, borderTop: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          size="small"
          multiline
          maxRows={4}
          placeholder={ready ? constants.RESERVATION_INPUT_PLACEHOLDER : 'Connecting…'}
          value={input}
          disabled={!ready || sending}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit(input);
            }
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => submit(input)} disabled={!ready || sending || !input.trim()} size="small">
                  <SendIcon sx={{ fontSize: 18, color: input.trim() && ready && !sending ? NAVY : MUTED }} />
                </IconButton>
              </InputAdornment>
            ),
            sx: { borderRadius: 5, bgcolor: 'background.paper' },
          }}
        />
      </Box>
    </Box>
  );
}
