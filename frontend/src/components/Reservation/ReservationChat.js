import { useState, useRef, useEffect, useCallback } from 'react';
import { Box, TextField, IconButton, InputAdornment, CircularProgress } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { io } from 'socket.io-client';
import { NAVY, MUTED, BORDER } from '../../theme';
import constants from '../../constants.json';
import { sessionStorageKey, sessionAuth, saveSessionToken } from './reservationSession';
import { getBackendUrl, ChatBubble, SuggestionStrip, ThinkingBubble } from '../GuestPortal/GuestConcierge';
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
  // Connecting, then waiting on each reply. Local, not the app's: that one covers the page.
  const [loading, setLoading] = useState(true);
  const [streamingContent, setStreamingContent] = useState('');
  // The language she last replied in, so the buttons and the input speak it too.
  const [language, setLanguage] = useState(constants.RESERVATION_DEFAULT_LANGUAGE);

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
      setLoading(false);
      setLanguage(payload?.languageCode || constants.RESERVATION_DEFAULT_LANGUAGE);
      onHotelResolvedRef.current?.(payload?.hotel || null);
      saveSessionToken(storageKeyRef.current, payload?.sessionToken);
      const history = Array.isArray(payload?.messages) ? payload.messages : [];
      // The conversation opens with her greeting, as the voice line does. It is
      // shown, not generated or stored, so a visitor who never types costs nothing.
      const greeting = {
        id: 'greeting',
        role: 'assistant',
        content: constants.RESERVATION_CHAT_GREETING.split(constants.RESERVATION_GREETING_HOTEL_TOKEN).join(payload?.hotel?.name || ''),
      };
      setMessages([greeting, ...history.map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt }))]);
      requestAnimationFrame(scrollToBottom);
      setTimeout(() => inputRef.current?.focus?.(), 100);
    });

    // The chat row is created on the first message, so its handle arrives here.
    socket.on('session', (payload) => {
      saveSessionToken(storageKeyRef.current, payload?.sessionToken);
    });

    socket.on('stream_chunk', (p) => {
      setStreamingContent((prev) => prev + (p.content || ''));
      requestAnimationFrame(scrollToBottom);
    });

    socket.on('stream_end', (p) => {
      if (p.languageCode) {
        setLanguage(p.languageCode);
      }
      if (p.content) {
        setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: p.content, createdAt: new Date().toISOString() }]);
        requestAnimationFrame(scrollToBottom);
      }
      setStreamingContent('');
      setLoading(false);
      setTimeout(() => inputRef.current?.focus?.(), 0);
    });

    socket.on('error', (p) => {
      setStreamingContent('');
      setLoading(false);
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
    if (!content || loading || !socketRef.current?.connected) return;
    setInput('');
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', content, createdAt: new Date().toISOString() }]);
    requestAnimationFrame(scrollToBottom);
    setLoading(true);
    setStreamingContent('');
    socketRef.current.emit('message', { content });
  }, [loading]);

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
        {loading && messages.length === 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
            <CircularProgress size={24} sx={{ color: 'primary.main' }} />
          </Box>
        )}

        <MapComponent Component={MessageBubble} data={messages} showNoDataAvailable={false} />
        {loading && streamingContent && <ChatBubble message={{ role: 'assistant', content: streamingContent }} />}
        {loading && messages.length > 0 && !streamingContent && <ThinkingBubble />}
      </Box>

      {!loading && (
        <Box sx={{ px: { xs: 2, md: 3 }, pt: 1.5, pb: 0.5, flexShrink: 0 }}>
          <SuggestionStrip items={constants.RESERVATION_SUGGESTIONS[language]} onSelect={submit} disabled={loading} />
        </Box>
      )}

      <Box sx={{ px: { xs: 2, md: 3 }, py: 2, borderTop: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          size="small"
          multiline
          maxRows={4}
          placeholder={messages.length > 0 ? constants.RESERVATION_INPUT_PLACEHOLDER[language] : constants.RESERVATION_CONNECTING}
          value={input}
          disabled={loading}
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
                <IconButton onClick={() => submit(input)} disabled={loading || !input.trim()} size="small">
                  <SendIcon sx={{ fontSize: 18, color: input.trim() && !loading ? NAVY : MUTED }} />
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
