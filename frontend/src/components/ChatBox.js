import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Box, Button, CircularProgress, IconButton, TextField, Typography } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import MicIcon from '@mui/icons-material/Mic';
import { io } from 'socket.io-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const getBackendUrl = () => (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');

function ChatBox({ bookingId, alertError }) {
  const [socket, setSocket] = useState(null);
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [sending, setSending] = useState(false);
  const [connectionNote, setConnectionNote] = useState('');
  const inputRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  const focusInput = useCallback(() => {
    // Wait a tick so disabled state updates first.
    setTimeout(() => {
      inputRef.current?.focus?.();
    }, 0);
  }, []);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    // Prefer scrolling the container to avoid weird jumps when user scrolls up.
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior });
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    if (shouldAutoScroll) scrollToBottom('smooth');
  }, [messages, streamingContent, shouldAutoScroll, scrollToBottom]);

  useEffect(() => {
    if (!bookingId || isNaN(bookingId)) return;
    const token = localStorage.getItem('token');
    if (!token) {
      alertError?.('Please log in to talk to Cassandra');
      return;
    }

    const connectUrl = getBackendUrl();
    if (!connectUrl) {
      alertError?.('Backend URL not configured');
      return;
    }
    // Gateway listens on namespace /chat
    const socketInstance = io(`${connectUrl}/chat`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      query: { token, bookingId: String(bookingId) },
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      // Socket.IO uses exponential backoff between these bounds.
      reconnectionDelay: 500,
      reconnectionDelayMax: 8000,
      randomizationFactor: 0.2,
    });

    socketRef.current = socketInstance;
    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setConnectionNote('');
    });

    socketInstance.on('disconnect', (reason) => {
      setReady(false);
      setConnectionNote('Disconnected. Reconnecting…');
    });

    socketInstance.io.on('reconnect_attempt', (attempt) => {
      setConnectionNote(`Reconnecting… (${attempt}/5)`);
    });

    socketInstance.io.on('reconnect', () => {
      setConnectionNote('');
    });

    socketInstance.io.on('reconnect_failed', () => {
      setConnectionNote('Could not reconnect.');
    });

    socketInstance.on('ready', (payload) => {
      setReady(true);
      setConnectionNote('');
      if (payload.messages && Array.isArray(payload.messages)) {
        setMessages(
          payload.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
          })),
        );
        setShouldAutoScroll(true);
        // Let the DOM paint before trying to scroll.
        setTimeout(() => scrollToBottom('auto'), 0);
        focusInput();
      }
    });

    socketInstance.on('auth_required', () => {
      socketInstance.emit('auth', { token, bookingId });
    });

    socketInstance.on('stream_chunk', (payload) => {
      setStreamingContent((prev) => prev + (payload.content || ''));
    });

    socketInstance.on('stream_end', (payload) => {
      setStreamingContent('');
      if (payload.content) {
        setMessages((prev) => [...prev, { id: `assistant-${Date.now()}`, role: 'assistant', content: payload.content, createdAt: new Date().toISOString() }]);
      }
      setSending(false);
      focusInput();
    });

    socketInstance.on('error', (payload) => {
      setStreamingContent('');
      setSending(false);
      alertError?.(payload?.message || 'Something went wrong');
      focusInput();
    });

    socketInstance.on('voice_ready', (payload) => {
      if (payload?.message) alertError?.(payload.message);
    });

    socketInstance.on('connect_error', (err) => {
      alertError?.(err?.message || 'Connection failed');
    });

    return () => {
      socketInstance.removeAllListeners();
      socketInstance.disconnect();
      socketRef.current = null;
    };
  }, [bookingId, alertError, focusInput, scrollToBottom]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || !socket?.connected || sending) return;
    setInput('');
    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: 'user', content: text, createdAt: new Date().toISOString() }]);
    setSending(true);
    setStreamingContent('');
    setShouldAutoScroll(true);
    socket.emit('message', { content: text });
  };

  const handleVoice = () => {
    if (!socket?.connected) return;
    socket.emit('voice_start');
  };

  if (!bookingId || isNaN(bookingId)) {
    return null;
  }

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShouldAutoScroll(distanceFromBottom < 120);
  };

  const renderMarkdown = (content, variant = 'assistant') => {
    const isUser = variant === 'user';
    return (
      <Box
        sx={{
          '& p': { m: 0 },
          '& ul, & ol': { m: 0, pl: 2.5 },
          '& li': { mt: 0.5 },
          '& a': { color: 'inherit' },
          '& code': { fontFamily: 'monospace' },
          '& pre': {
            m: 0,
            p: 1,
            overflow: 'auto',
            borderRadius: 1,
            bgcolor: isUser ? 'rgba(255, 0, 0, 0.18)' : 'action.hover',
          },
          '& :not(pre) > code': {
            px: 0.6,
            py: 0.2,
            borderRadius: 0.8,
            bgcolor: isUser ? 'rgba(255,255,255,0.16)' : 'action.hover',
          },
        }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || ''}</ReactMarkdown>
      </Box>
    );
  };

  const chatInner = (
    <>
      <Box
        ref={scrollContainerRef}
        onScroll={handleScroll}
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {messages.map((m) => (
          <Box
            key={m.id}
            sx={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              px: 2,
              py: 1,
              borderRadius: 2,
              bgcolor: m.role === 'user' ? 'primary.main' : 'action.hover',
              color: m.role === 'user' ? 'primary.contrastText' : 'text.primary',
            }}
          >
            {renderMarkdown(m.content, m.role)}
          </Box>
        ))}
        {streamingContent && (
          <Box
            sx={{
              alignSelf: 'flex-start',
              maxWidth: '85%',
              px: 2,
              py: 1,
              borderRadius: 2,
              bgcolor: 'action.hover',
            }}
          >
            {renderMarkdown(streamingContent)}
          </Box>
        )}
        <div ref={messagesEndRef} />
      </Box>

      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1, alignItems: 'flex-end' }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          size="small"
          placeholder="Type a message…"
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
        />
        <IconButton color="primary" onClick={handleVoice} disabled={!ready} aria-label="Voice">
          <MicIcon />
        </IconButton>
        <Button variant="contained" onClick={handleSend} disabled={!ready || sending || !input.trim()} endIcon={<SendIcon />}>
          Send
        </Button>
      </Box>
    </>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '60vh', width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="h6">Cassandra will help you with this booking</Typography>
        {(sending || streamingContent) && <CircularProgress size={16} />}
        {connectionNote ? (
          <Typography variant="caption" color="text.secondary">
            {connectionNote}
          </Typography>
        ) : (
          !ready && (
            <Typography variant="caption" color="text.secondary">
              Connecting…
            </Typography>
          )
        )}
      </Box>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: 1, borderColor: 'divider', borderRadius: 2 }}>{chatInner}</Box>
    </Box>
  );
}

export default ChatBox;
