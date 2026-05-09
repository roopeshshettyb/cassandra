import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Box, Typography, TextField, IconButton, InputAdornment, Chip } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BORDER, SHADOW, BRAND_GRADIENT, PRIMARY_CONTRAST, MUTED, NAVY, BG } from '../../theme';
import { useSocketAllRounder } from './hooks/useSocketAllRounder';
import AgentCardRenderer from './AgentCardRenderer';
import constants from '../../constants.json';

export const PANEL_WIDTH = 420;

const ROLE_SUGGESTIONS = {
  admin: ['Show high priority requests', 'Hotel stats overview', "Today's check-ins", 'Search a booking'],
  hotel_owner: ['High priority requests today', 'My hotel stats', "Today's check-ins", 'Pending requests'],
  hotel_staff: ['Show pending requests', 'High priority requests', "Today's bookings", 'Update a request'],
};

function getDateLabel(date) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function DateSeparator({ label }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, my: 0.5 }}>
      <Box sx={{ flex: 1, height: '1px', bgcolor: BORDER }} />
      <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
        {label}
      </Typography>
      <Box sx={{ flex: 1, height: '1px', bgcolor: BORDER }} />
    </Box>
  );
}

function ChatBubble({ message, navigate }) {
  const isUser = message.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '84%', display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      {!isUser && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 18, height: 18, borderRadius: 1, background: BRAND_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <SmartToyIcon sx={{ fontSize: 11, color: PRIMARY_CONTRAST }} />
          </Box>
          <Typography sx={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {constants.AI_ASSISTANT_TITLE || 'AI Assistant'}
          </Typography>
        </Box>
      )}
      <Box
        sx={{
          px: 1.75,
          py: 1,
          borderRadius: isUser ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
          background: isUser ? BRAND_GRADIENT : 'background.paper',
          border: isUser ? 'none' : `1px solid ${BORDER}`,
          boxShadow: SHADOW,
          color: isUser ? PRIMARY_CONTRAST : 'text.primary',
          fontSize: 13.5,
          lineHeight: 1.55,
          '& p': { m: 0 },
          '& ul, & ol': { m: 0, pl: 2 },
          '& li': { mt: 0.3 },
          '& a': { color: 'inherit' },
          '& code': { fontFamily: 'monospace', fontSize: 11.5 },
          '& strong': { fontWeight: 700 },
        }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || ''}</ReactMarkdown>
      </Box>
      {message.cards?.length > 0 && <AgentCardRenderer cards={message.cards} navigate={navigate} />}
    </motion.div>
  );
}

function ThinkingBubble() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, alignSelf: 'flex-start' }}>
      <Box sx={{ width: 18, height: 18, borderRadius: 1, background: BRAND_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <SmartToyIcon sx={{ fontSize: 11, color: PRIMARY_CONTRAST }} />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 1, borderRadius: '4px 14px 14px 14px', border: `1px solid ${BORDER}`, bgcolor: 'background.paper', boxShadow: SHADOW }}>
        {[0, 1, 2].map((i) => (
          <motion.div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: MUTED }}
            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />
        ))}
      </Box>
    </Box>
  );
}

function buildMessageList(messages) {
  const result = [];
  let lastDateLabel = null;
  for (const msg of messages) {
    const dateLabel = getDateLabel(msg.createdAt);
    if (dateLabel && dateLabel !== lastDateLabel) {
      result.push({ type: 'separator', label: dateLabel, key: `sep-${dateLabel}` });
      lastDateLabel = dateLabel;
    }
    result.push({ type: 'message', msg, key: String(msg.id) });
  }
  return result;
}

// Inner component — mounts only when panel is open, so socket connects only then
function ChatPanel({ account, navigate, alertError, isMobile, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const addMessage = useCallback((role, content, cards = []) => {
    setMessages((prev) => [...prev, { role, content, cards, id: Date.now() + Math.random(), createdAt: new Date().toISOString() }]);
  }, []);

  const { isReady, isRecording, isSpeaking, isProcessing, isSending, sendMessage, startRecording, stopRecording } = useSocketAllRounder({
    onReady: (dbMessages) => {
      if (dbMessages?.length) {
        setMessages(dbMessages.map((m) => ({ role: m.role, content: m.content, cards: [], id: m.id, createdAt: m.createdAt })));
      }
    },
    onStreamChunk: (chunk) => setStreamingContent((prev) => prev + chunk),
    onStreamEnd: ({ content, cards }) => { setStreamingContent(''); addMessage('assistant', content, cards); },
    onUserMessage: (text) => addMessage('user', text),
    onVoiceTextEnd: ({ text, cards }) => addMessage('assistant', text, cards),
    onError: (err) => alertError?.(err),
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamingContent]);

  const handleSend = useCallback((text) => {
    const content = (text ?? input).trim();
    if (!content || !isReady || isSending) return;
    addMessage('user', content);
    sendMessage(content);
    setInput('');
    inputRef.current?.focus();
  }, [input, isReady, isSending, addMessage, sendMessage]);

  const showThinking = (isProcessing || isSending) && !streamingContent;
  const suggestions = ROLE_SUGGESTIONS[account?.role] || [];
  const items = buildMessageList(messages);
  const headerState = isRecording ? 'Listening…' : isProcessing ? 'Thinking…' : isSpeaking ? 'Speaking…' : isReady ? 'Online' : 'Connecting…';
  const headerStateColor = isRecording ? '#DC2626' : isProcessing || isSpeaking ? 'primary.main' : isReady ? '#059669' : MUTED;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: BG, overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5, borderBottom: `1px solid ${BORDER}`, bgcolor: 'background.paper', flexShrink: 0 }}>
        <Box sx={{ width: 34, height: 34, borderRadius: 1.75, background: BRAND_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(197,160,34,0.25)' }}>
          {isSpeaking ? (
            <motion.div animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 0.8, repeat: Infinity }}>
              <GraphicEqIcon sx={{ fontSize: 18, color: PRIMARY_CONTRAST }} />
            </motion.div>
          ) : (
            <SmartToyIcon sx={{ fontSize: 18, color: PRIMARY_CONTRAST }} />
          )}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>
            {constants.AI_ASSISTANT_TITLE || 'AI Assistant'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <motion.div
              animate={{ opacity: (isRecording || isProcessing || isSpeaking) ? [0.5, 1, 0.5] : 1 }}
              transition={{ duration: 1, repeat: Infinity }}
              style={{ width: 5, height: 5, borderRadius: '50%', background: isReady ? (isRecording ? '#DC2626' : isProcessing || isSpeaking ? '#D4AF37' : '#059669') : '#888' }}
            />
            <Typography sx={{ fontSize: 10, color: headerStateColor }}>{headerState}</Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: MUTED, '&:hover': { color: NAVY } }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

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
          scrollBehavior: 'smooth',
          '&::-webkit-scrollbar': { width: 3 },
          '&::-webkit-scrollbar-thumb': { borderRadius: 2, bgcolor: BORDER },
        }}
      >
        {messages.length === 0 && !streamingContent && (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2.5, py: 4 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 48, height: 48, borderRadius: 2.5, background: BRAND_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(197,160,34,0.3)' }}>
                <SmartToyIcon sx={{ fontSize: 24, color: PRIMARY_CONTRAST }} />
              </Box>
              <Typography sx={{ fontSize: 13, color: MUTED, textAlign: 'center', mt: 0.5 }}>How can I help you today?</Typography>
            </Box>
            {suggestions.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, justifyContent: 'center' }}>
                {suggestions.map((s) => (
                  <Chip
                    key={s}
                    label={s}
                    onClick={() => handleSend(s)}
                    size="small"
                    sx={{
                      cursor: 'pointer',
                      fontSize: 11.5,
                      bgcolor: 'background.paper',
                      border: `1px solid ${BORDER}`,
                      '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
                      transition: 'all 0.15s',
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>
        )}

        <AnimatePresence initial={false}>
          {items.map((item) =>
            item.type === 'separator' ? (
              <DateSeparator key={item.key} label={item.label} />
            ) : (
              <ChatBubble key={item.key} message={item.msg} navigate={navigate} />
            )
          )}
        </AnimatePresence>

        {showThinking && <ThinkingBubble />}

        {streamingContent && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ alignSelf: 'flex-start', maxWidth: '84%', display: 'flex', flexDirection: 'column', gap: 6 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 18, height: 18, borderRadius: 1, background: BRAND_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SmartToyIcon sx={{ fontSize: 11, color: PRIMARY_CONTRAST }} />
              </Box>
              <Typography sx={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {constants.AI_ASSISTANT_TITLE || 'AI Assistant'}
              </Typography>
            </Box>
            <Box sx={{ px: 1.75, py: 1, borderRadius: '4px 14px 14px 14px', border: `1px solid ${BORDER}`, bgcolor: 'background.paper', boxShadow: SHADOW, fontSize: 13.5, lineHeight: 1.55, '& p': { m: 0 } }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent + ' ▍'}</ReactMarkdown>
            </Box>
          </motion.div>
        )}
      </Box>

      {/* Input */}
      <Box sx={{ px: 2, py: 1.5, borderTop: `1px solid ${BORDER}`, bgcolor: 'background.paper', flexShrink: 0 }}>
        {isRecording && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1, px: 0.5 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <motion.div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: '#DC2626' }}
                animate={{ scaleY: [0.3, 1.8, 0.3] }}
                transition={{ duration: 0.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.07 }} />
            ))}
            <Typography sx={{ fontSize: 10, color: '#DC2626', ml: 0.5, fontWeight: 600, whiteSpace: 'nowrap' }}>Listening…</Typography>
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <Box sx={{ position: 'relative', flexShrink: 0 }}>
            {isRecording && (
              <motion.div
                style={{ position: 'absolute', inset: -5, borderRadius: '50%', border: '1.5px solid rgba(220,38,38,0.3)', pointerEvents: 'none' }}
                animate={{ opacity: [0.7, 0], scale: [1, 1.6] }}
                transition={{ duration: 1.1, repeat: Infinity }}
              />
            )}
            <IconButton
              onClick={() => isRecording ? stopRecording() : startRecording()}
              disabled={!isReady}
              size="small"
              sx={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: isRecording ? 'rgba(220,38,38,0.08)' : 'transparent',
                border: `1.5px solid ${isRecording ? 'rgba(220,38,38,0.4)' : BORDER}`,
                color: isRecording ? 'error.main' : 'text.secondary',
                transition: 'all 0.2s',
              }}
            >
              {isRecording ? <StopIcon sx={{ fontSize: 16 }} /> : <MicIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Box>
          <TextField
            inputRef={inputRef}
            fullWidth
            multiline
            maxRows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={isRecording ? 'Listening…' : 'Ask anything…'}
            disabled={!isReady || isRecording}
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
                fontSize: 13,
                bgcolor: BG,
                '& fieldset': { borderColor: BORDER },
                '&.Mui-focused fieldset': { borderColor: 'primary.main' },
              },
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => handleSend()}
                    disabled={!input.trim() || !isReady || isSending}
                    size="small"
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: 1.5,
                      background: input.trim() && isReady && !isSending ? BRAND_GRADIENT : 'transparent',
                      color: input.trim() && isReady && !isSending ? PRIMARY_CONTRAST : MUTED,
                      transition: 'all 0.2s',
                    }}
                  >
                    <SendIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </Box>
      <Box sx={{ height: 'env(safe-area-inset-bottom, 0px)', bgcolor: 'background.paper' }} />
    </Box>
  );
}

export default function AllRounderWidget({ account, navigate, alertError, isMobile, open, onOpenChange }) {
  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {open && isMobile && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 1199, background: 'rgba(0,0,0,0.45)' }}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ x: isMobile ? '100%' : PANEL_WIDTH }}
            animate={{ x: 0 }}
            exit={{ x: isMobile ? '100%' : PANEL_WIDTH }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            style={{
              position: 'fixed',
              top: isMobile ? 0 : 'var(--app-header-height, 64px)',
              right: 0,
              bottom: 0,
              width: isMobile ? '100%' : PANEL_WIDTH,
              zIndex: 1200,
              borderLeft: `1px solid ${BORDER}`,
              boxShadow: '-8px 0 40px rgba(0,0,0,0.1)',
            }}
          >
            <ChatPanel
              account={account}
              navigate={navigate}
              alertError={alertError}
              isMobile={isMobile}
              onClose={() => onOpenChange(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
