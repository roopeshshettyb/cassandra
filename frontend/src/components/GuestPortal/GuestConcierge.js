import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Avatar, Box, Typography, TextField, IconButton, InputAdornment, CircularProgress } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import MicIcon from '@mui/icons-material/Mic';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import SendIcon from '@mui/icons-material/Send';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import HistoryIcon from '@mui/icons-material/History';
import AddIcon from '@mui/icons-material/Add';
import { io } from 'socket.io-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { NAVY, MUTED, BRAND_GRADIENT, PRIMARY_CONTRAST, BORDER, SHADOW, SHADOW_BRAND, SHADOW_HOVER, NAVY_CONTRAST, HOVER_BG } from '../../theme';
import constants from '../../constants.json';

/** Return `count` items picked at random from `arr` (no repeats). */
const randomPick = (arr, count) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
};

dayjs.extend(relativeTime);

const getBackendUrl = () => (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');

const formatHistoryTimestamp = (value) => {
  try {
    const parsed = dayjs(value);
    if (!parsed.isValid()) {
      return 'Chat';
    }
    return parsed.fromNow();
  } catch {
    return 'Chat';
  }
};

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

function SuggestionStrip({ items, onSelect }) {
  const chipsScrollRef = useRef(null);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <IconButton
        size="small"
        onClick={() => chipsScrollRef.current?.scrollBy({ left: -220, behavior: 'smooth' })}
        sx={{ display: { xs: 'none', md: 'flex' }, flexShrink: 0, color: MUTED, '&:hover': { color: NAVY, bgcolor: HOVER_BG } }}
      >
        <ChevronLeftIcon fontSize="small" />
      </IconButton>

      <Box
        ref={chipsScrollRef}
        sx={{
          display: 'flex',
          gap: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          pb: 1,
          px: 0.5,
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {items.map((item) => (
          <Box
            key={item}
            component={motion.button}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(item)}
            sx={{
              flexShrink: 0,
              border: `1px solid ${BORDER}`,
              borderRadius: 5,
              px: 1.5,
              py: 0.75,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              color: NAVY,
              bgcolor: 'background.paper',
              boxShadow: SHADOW,
              whiteSpace: 'nowrap',
            }}
          >
            {item}
          </Box>
        ))}
      </Box>

      <IconButton
        size="small"
        onClick={() => chipsScrollRef.current?.scrollBy({ left: 220, behavior: 'smooth' })}
        sx={{ display: { xs: 'none', md: 'flex' }, flexShrink: 0, color: MUTED, '&:hover': { color: NAVY, bgcolor: HOVER_BG } }}
      >
        <ChevronRightIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

// ── Chat bubble renderer ───────────────────────────────────────────────────
function ChatBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <motion.div
      initial={false}
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
export function TextChatPanel({ bookingId, isWithinStay, alertError, onSwitchToVoice, hotelName, initialPrompt, suggestions, showHeader = true }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [chatList, setChatList] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const socketRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const historyToggleRef = useRef(null);
  const historyPanelRef = useRef(null);
  const initialPromptSentRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);
  const sendingRef = useRef(false);
  const scrollRafRef = useRef(null);

  useEffect(() => {
    if (!showHistory) return;
    const onDocPointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (historyToggleRef.current && historyToggleRef.current.contains(target)) return;
      if (historyPanelRef.current && historyPanelRef.current.contains(target)) return;
      setShowHistory(false);
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [showHistory]);

  const scrollToBottomNow = useCallback(() => {
    shouldAutoScrollRef.current = true;
    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
    const scrollEl = scrollRef.current;
    if (scrollEl) {
      scrollEl.scrollTop = scrollEl.scrollHeight;
    }
  }, []);

  const scheduleAutoScroll = useCallback(() => {
    if (!shouldAutoScrollRef.current || scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const scrollEl = scrollRef.current;
      if (!scrollEl || !shouldAutoScrollRef.current) return;
      scrollEl.scrollTop = scrollEl.scrollHeight;
    });
  }, []);

  useEffect(() => {
    scheduleAutoScroll();
  }, [messages, streamingContent, scheduleAutoScroll]);

  useEffect(() => () => {
    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
  }, []);

  const handleMessagesScroll = useCallback((event) => {
    if (sendingRef.current) {
      shouldAutoScrollRef.current = true;
      return;
    }
    const target = event.currentTarget;
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom <= 24;
  }, []);

  useEffect(() => {
    if (bookingId && !isWithinStay) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    const url = getBackendUrl();
    if (!url) return;
    const query = { token };
    if (bookingId) {
      query.bookingId = String(bookingId);
    }

    const socket = io(`${url}/chat`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      query,
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    socket.on('ready', (payload) => {
      setReady(true);
      setCurrentChatId(payload?.chatId || null);
      if (Array.isArray(payload?.messages)) {
        const nextMessages = [];
        for (const m of payload.messages) {
          nextMessages.push({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt });
        }
        setMessages(nextMessages);
      }
      if (initialPrompt && !initialPromptSentRef.current) {
        initialPromptSentRef.current = true;
        shouldAutoScrollRef.current = true;
        sendingRef.current = true;
        setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', content: initialPrompt, createdAt: new Date().toISOString() }]);
        setSending(true);
        socket.emit('message', { content: initialPrompt });
      } else {
        setTimeout(() => inputRef.current?.focus?.(), 100);
      }
    });
    socket.on('chat_history', (payload) => {
      const nextChats = [];
      const rows = Array.isArray(payload?.chats) ? payload.chats : [];
      for (const row of rows) {
        nextChats.push({
          id: row.id,
          createdAt: row.createdAt,
          chatType: row.chatType,
          bookingId: row.bookingId ?? null,
          title: row.title || 'New chat',
        });
      }
      setChatList(nextChats);
      setCurrentChatId(payload?.currentChatId ?? null);
    });
    socket.on('auth_required', () => socket.emit('auth', bookingId ? { token, bookingId } : { token }));
    socket.on('stream_chunk', (p) => setStreamingContent((prev) => prev + (p.content || '')));
    socket.on('stream_end', (p) => {
      if (p.content) {
        setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: p.content, createdAt: new Date().toISOString() }]);
      }
      shouldAutoScrollRef.current = true;
      sendingRef.current = false;
      setSending(false);
      setTimeout(() => inputRef.current?.focus?.(), 0);
    });
    socket.on('error', (p) => {
      setStreamingContent('');
      sendingRef.current = false;
      setSending(false);
      alertError?.(p?.message || 'Something went wrong');
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !socket.connected) {
        socket.connect();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [bookingId, isWithinStay, alertError]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || !socketRef.current?.connected || sending) return;
    setInput('');
    inputRef.current?.blur?.();
    shouldAutoScrollRef.current = true;
    sendingRef.current = true;
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', content: text, createdAt: new Date().toISOString() }]);
    setSending(true);
    setStreamingContent('');
    socketRef.current.emit('message', { content: text });
    requestAnimationFrame(scrollToBottomNow);
    setTimeout(scrollToBottomNow, 150);
  }, [input, sending, scrollToBottomNow]);

  const handleOpenChat = useCallback((chatId) => {
    if (!socketRef.current?.connected || !chatId) return;
    sendingRef.current = false;
    setSending(false);
    setStreamingContent('');
    socketRef.current.emit('open_chat', { chatId });
  }, []);

  const handleNewChat = useCallback(() => {
    if (!socketRef.current?.connected) return;
    sendingRef.current = false;
    setSending(false);
    setStreamingContent('');
    socketRef.current.emit('new_chat');
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Desktop Header */}
      {showHeader && (
        <Box sx={{ px: { xs: 2, md: 3 }, pt: { xs: 1.5, md: 2 }, pb: { xs: 1.5, md: 2 }, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: 'transparent', flexShrink: 0 }}>
          <Avatar sx={{ width: 44, height: 44, background: BRAND_GRADIENT, color: PRIMARY_CONTRAST, boxShadow: SHADOW }}>
            <SupportAgentIcon sx={{ fontSize: 24 }} />
          </Avatar>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: NAVY, lineHeight: 1.2 }}>AI Concierge</Typography>
            <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.2 }}>{hotelName}</Typography>
          </Box>
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              ref={historyToggleRef}
              size="small"
              onClick={() => setShowHistory((prev) => !prev)}
              title="Recent chats"
              sx={{ color: showHistory ? 'primary.main' : MUTED }}
            >
              <HistoryIcon sx={{ fontSize: 20 }} />
            </IconButton>
            <IconButton size="small" onClick={handleNewChat} disabled={!ready || sending} title="New chat">
              <AddIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      )}

      {showHistory && (
        <Box
          ref={historyPanelRef}
          sx={{
            position: 'absolute',
            top: { xs: 64, md: 78 },
            left: { xs: 12, md: 16 },
            right: { xs: 12, md: 16 },
            px: 1.25,
            py: 1,
            border: `1px solid ${BORDER}`,
            borderRadius: 2,
            backgroundColor: 'background.paper',
            boxShadow: SHADOW_HOVER,
            maxHeight: 180,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.8,
            '&::-webkit-scrollbar': { width: 6 },
            zIndex: 20,
          }}
        >
          {(() => {
            const items = [];
            for (const chat of chatList) {
              const isActive = chat.id === currentChatId;
              items.push(
                <Box
                  key={chat.id}
                  onClick={() => handleOpenChat(chat.id)}
                  sx={{
                    border: `1px solid ${isActive ? 'transparent' : BORDER}`,
                    background: isActive ? BRAND_GRADIENT : 'background.paper',
                    color: isActive ? PRIMARY_CONTRAST : 'text.primary',
                    borderRadius: 2,
                    cursor: 'pointer',
                    px: 1.25,
                    py: 0.85,
                    boxShadow: SHADOW,
                  }}
                >
                  <Typography sx={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}>
                    {chat.title}
                  </Typography>
                  <Typography sx={{ fontSize: 10, mt: 0.3, opacity: isActive ? 0.9 : 0.7 }}>
                    {formatHistoryTimestamp(chat.createdAt)}
                  </Typography>
                </Box>,
              );
            }
            return items;
          })()}
        </Box>
      )}

      {/* Messages */}
      <Box
        ref={scrollRef}
        onScroll={handleMessagesScroll}
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
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', py: { xs: 3, md: '4vh' }, px: 2 }}>
              <Box sx={{ position: 'relative', display: 'inline-block', mb: 4 }}>
                <Box sx={{ position: 'absolute', top: -30, left: -30, right: -30, bottom: -30, background: BRAND_GRADIENT, filter: 'blur(40px)', opacity: 0.15, borderRadius: '50%' }} />
                <Avatar sx={{ width: 80, height: 80, background: BRAND_GRADIENT, color: PRIMARY_CONTRAST, boxShadow: '0 12px 32px rgba(0,0,0,0.1)', position: 'relative', zIndex: 1, border: '2px solid rgba(255,255,255,0.8)' }}>
                  <SupportAgentIcon sx={{ fontSize: 40 }} />
                </Avatar>
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: { xs: 26, md: 32 }, mb: 1.5, color: NAVY }}>
                Hi! I'm your AI Concierge.
              </Typography>
              <Typography sx={{ fontSize: { xs: 14, md: 16 }, color: MUTED, maxWidth: 500, mx: 'auto', mb: 2, lineHeight: 1.6 }}>
                Experience {hotelName} effortlessly. I'm here 24/7 to manage your requests, provide local insights, and elevate your stay.
              </Typography>
            </Box>
          </motion.div>
        )}

        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} />
        ))}
        {sending && streamingContent && <ChatBubble message={{ role: 'assistant', content: streamingContent }} />}
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

      {/* Suggestion chips */}
      {ready && !sending && (
        <Box
          sx={{
            px: { xs: 2, md: 3 },
            pt: 1.5,
            pb: 0.5,
            flexShrink: 0,
          }}
        >
          <SuggestionStrip
            items={suggestions}
            onSelect={(suggestion) => {
              if (!sending && socketRef.current?.connected) {
                shouldAutoScrollRef.current = true;
                sendingRef.current = true;
                setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', content: suggestion, createdAt: new Date().toISOString() }]);
                setSending(true);
                setStreamingContent('');
                socketRef.current.emit('message', { content: suggestion });
              }
            }}
          />
        </Box>
      )}

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
                <Box sx={{ display: 'block' }}>
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
                    background: 'none',
                    color: (!input.trim() || sending) ? MUTED : 'primary.main',
                    transition: 'color 0.2s',
                    '&:hover': { background: 'none' },
                    '&.Mui-disabled': { opacity: 0.5 },
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
export default function GuestConcierge({
  booking,
  accountRole,
  alertError,
  isWithinStay,
  logoUrl,
  isReady,
  isRecording,
  isProcessing,
  isSpeaking,
  startRecording,
  stopRecording,
  sendText,
  hasInteractedRef,
  userStoppedRef,
  mode,
  onModeChange,
  initialPrompt,
  bookingIdOverride,
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const isModeControlled = typeof mode === 'string' && typeof onModeChange === 'function';
  const showChat = isModeControlled ? mode === 'chat' : searchParams.get('mode') === 'chat';

  const openChat = useCallback(() => {
    if (!isWithinStay) {
      alertError?.(constants.ERROR_CHAT_ONLY_DURING_STAY);
      return;
    }
    if (isModeControlled) {
      onModeChange('chat');
      return;
    }
    setSearchParams({ tab: 'concierge', mode: 'chat' });
  }, [isWithinStay, alertError, isModeControlled, onModeChange, setSearchParams]);
  const openVoice = useCallback(() => {
    if (isModeControlled) {
      onModeChange('voice');
      return;
    }
    setSearchParams({ tab: 'concierge' });
  }, [isModeControlled, onModeChange, setSearchParams]);

  const hotelName = booking?.hotel?.name || 'Hotel';
  const conciergeSuggestions = useMemo(() => {
    const roleSuggestionMap = constants.AI_ASSISTANT_ROLE_SUGGESTIONS;
    const normalizedRole = typeof accountRole === 'string' ? accountRole : '';
    const roleSuggestions = roleSuggestionMap?.[normalizedRole];
    const guestSuggestions = roleSuggestionMap?.guest;
    if (Array.isArray(roleSuggestions) && roleSuggestions.length > 0) {
      return randomPick(roleSuggestions, 8);
    }
    if (Array.isArray(guestSuggestions) && guestSuggestions.length > 0) {
      return randomPick(guestSuggestions, 8);
    }
    return [];
  }, [accountRole]);

  const handleMicTap = async () => {
    if (!isWithinStay) {
      alertError?.(constants.ERROR_CHAT_ONLY_DURING_STAY);
      return;
    }
    if (isRecording) {
      // User explicitly stops — break the continuous loop
      userStoppedRef.current = true;
      stopRecording();
    } else {
      // User explicitly starts — enter continuous loop
      userStoppedRef.current = false;
      hasInteractedRef.current = true;
      try {
        await startRecording();
      } catch (e) {
        alertError?.(e?.message || 'Could not start recording');
      }
    }
  };

  if (showChat) {
    const chatPrompt = isModeControlled ? initialPrompt || '' : searchParams.get('prompt') || '';
    return (
      <Box sx={{ height: '100%', display: 'flex', justifyContent: 'center', minHeight: 0 }}>
        <Box sx={{ width: '100%', maxWidth: { md: 900 }, height: '100%', display: 'flex', flexDirection: 'column', bgcolor: { xs: 'background.default', md: 'background.default' }, minHeight: 0, borderRadius: { md: 4 }, overflow: 'hidden', border: { md: `1px solid ${BORDER}` }, boxShadow: { md: '0 24px 48px rgba(0,0,0,0.06)' } }}>
          {/* Main Centered Text Chat Panel */}
          <TextChatPanel bookingId={bookingIdOverride ?? booking?.id} isWithinStay={isWithinStay} alertError={alertError} onSwitchToVoice={openVoice} hotelName={hotelName} initialPrompt={chatPrompt} suggestions={conciergeSuggestions} showHeader={!booking} />
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        height: '100%',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        px: 2.5,
        pt: { xs: 2, md: '1.5vh' },
        pb: { xs: '68px', md: 2 },
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

        {/* Mic button — flex:1 centers it in the available space */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2.5 }}>
          {(() => {
            const isActive = isRecording || isProcessing || isSpeaking;
            const statusText = !isWithinStay
              ? 'Available during your stay'
              : isRecording
              ? 'Listening… tap to stop'
              : isSpeaking
              ? 'Responding…'
              : isProcessing
              ? 'Thinking…'
              : 'Tap to speak';
            return (
              <>
                <motion.button
                  onClick={handleMicTap}
                  style={{
                    width: 140,
                    height: 140,
                    borderRadius: '50%',
                    border: 'none',
                    cursor: isWithinStay ? 'pointer' : 'not-allowed',
                    background: isActive ? BRAND_GRADIENT : NAVY,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: isActive ? SHADOW_BRAND : SHADOW,
                    outline: 'none',
                  }}
                  whileTap={{ scale: 0.94 }}
                >
                  <AnimatePresence mode="wait">
                    {isActive ? (
                      <motion.div key="waveform" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ duration: 0.2 }}>
                        <WaveformBars />
                      </motion.div>
                    ) : (
                      <motion.div key="mic" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ duration: 0.2 }}>
                        <MicIcon sx={{ fontSize: 44, color: NAVY_CONTRAST }} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>

                <Typography sx={{ fontSize: 14, color: MUTED, letterSpacing: '0.04em', textAlign: 'center', fontWeight: 500 }}>
                  {statusText}
                </Typography>
              </>
            );
          })()}
        </Box>

        {/* Suggestion chips — horizontal scroll strip, shown only when idle */}
        <AnimatePresence>
          {isWithinStay && !isRecording && !isProcessing && !isSpeaking && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
            >
              <SuggestionStrip
                items={conciergeSuggestions}
                onSelect={(prompt) => {
                  hasInteractedRef.current = true;
                  userStoppedRef.current = false;
                  sendText(prompt);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Prefer to type? — always visible at bottom */}
        <Box sx={{ textAlign: 'center', py: 1 }}>
          <motion.button
            onClick={openChat}
            style={{
              background: 'none',
              border: 'none',
              cursor: isWithinStay ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: MUTED,
              fontSize: 14,
              fontWeight: 500,
              padding: '8px 16px',
              opacity: isWithinStay ? 1 : 0.5,
            }}
            whileTap={isWithinStay ? { scale: 0.97 } : undefined}
          >
            <ChatBubbleOutlineIcon sx={{ fontSize: 18, color: MUTED }} />
            Prefer to type?
          </motion.button>
        </Box>
      </Box>
    </Box>
  );
}
