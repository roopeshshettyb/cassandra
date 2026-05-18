import { useState, useRef, useCallback } from 'react';
import { Box, Typography, TextField, IconButton, InputAdornment, Chip } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BORDER, SHADOW, BRAND_GRADIENT, PRIMARY_CONTRAST, MUTED, BG } from '../../theme';
import { useSocketAllRounder } from './hooks/useSocketAllRounder';
import constants from '../../constants.json';
import { ChatBubble, ThinkingBubble, DateSeparator, buildMessageList, useAutoScroll } from './AllRounderChatComponents';

const ROLE_LABELS = {
  admin: 'Admin',
  hotel_owner: 'Hotel Owner',
  hotel_staff: 'Hotel Staff',
  guest: 'Guest',
};

const ROLE_SUGGESTIONS = {
  admin: ['Show high priority requests', 'Hotel stats overview', "Today's check-ins across hotels", 'Search a booking'],
  hotel_owner: ['High priority requests today', 'My hotel stats', "Today's check-ins", 'Pending requests'],
  hotel_staff: ['Show pending requests', 'High priority requests', "Today's bookings", 'Update a request'],
  guest: ['I need room service', 'Request housekeeping', 'Book a taxi for me', "What's included in my stay?"],
};


function MicButton({ isRecording, isReady, isProcessing, isSpeaking, onClick }) {
  const active = isRecording || isProcessing || isSpeaking;
  return (
    <Box sx={{ position: 'relative', flexShrink: 0 }}>
      {isRecording && (
        <>
          {[1, 2].map((ring) => (
            <motion.div
              key={ring}
              style={{
                position: 'absolute', inset: -ring * 6,
                borderRadius: '50%',
                border: '1.5px solid',
                borderColor: 'rgba(220,38,38,0.3)',
                pointerEvents: 'none',
              }}
              animate={{ opacity: [0.6, 0], scale: [1, 1.5] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: ring * 0.3 }}
            />
          ))}
        </>
      )}
      <IconButton
        onClick={onClick}
        disabled={!isReady}
        sx={{
          width: 42,
          height: 42,
          borderRadius: '50%',
          background: isRecording ? 'rgba(220,38,38,0.1)' : active ? BRAND_GRADIENT : 'background.paper',
          border: `1.5px solid ${isRecording ? 'rgba(220,38,38,0.5)' : active ? 'transparent' : BORDER}`,
          color: isRecording ? 'error.main' : active ? PRIMARY_CONTRAST : 'text.secondary',
          transition: 'all 0.2s',
          '&:hover': { opacity: 0.85 },
          '&.Mui-disabled': { opacity: 0.4 },
        }}
      >
        {isRecording ? <StopIcon sx={{ fontSize: 18 }} /> : <MicIcon sx={{ fontSize: 18 }} />}
      </IconButton>
    </Box>
  );
}


export default function AllRounderPage({ account, navigate, alertError }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const isFirstLoad = useRef(true);

  const addMessage = useCallback((role, content, cards = []) => {
    setMessages((prev) => [...prev, { role, content, cards, id: Date.now() + Math.random(), createdAt: new Date().toISOString() }]);
  }, []);

  const { isReady, isRecording, isSpeaking, isProcessing, isSending, sendMessage, startRecording, stopRecording } = useSocketAllRounder({
    onReady: (dbMessages) => {
      if (dbMessages?.length) {
        setMessages(dbMessages.map((m) => ({ role: m.role, content: m.content, cards: [], id: m.id, createdAt: m.createdAt })));
      }
      isFirstLoad.current = false;
    },
    onStreamChunk: (chunk) => setStreamingContent((prev) => prev + chunk),
    onStreamEnd: ({ content, cards }) => {
      setStreamingContent('');
      addMessage('assistant', content, cards);
    },
    onUserMessage: (text) => addMessage('user', text),
    onVoiceTextEnd: ({ text, cards }) => addMessage('assistant', text, cards),
    onError: (err) => alertError?.(err),
  });

  useAutoScroll(scrollRef, [messages, streamingContent]);

  const handleSend = useCallback((text) => {
    const content = (text || input).trim();
    if (!content || !isReady || isSending) return;
    addMessage('user', content);
    sendMessage(content);
    setInput('');
    inputRef.current?.focus();
  }, [input, isReady, isSending, addMessage, sendMessage]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const showThinking = (isProcessing || isSending) && !streamingContent;
  const suggestions = ROLE_SUGGESTIONS[account?.role] || [];
  const items = buildMessageList(messages);

  const headerState = isRecording ? 'Listening…' : isProcessing ? 'Thinking…' : isSpeaking ? 'Speaking…' : isReady ? 'Online' : 'Connecting…';
  const headerStateColor = isRecording ? '#DC2626' : isProcessing || isSpeaking ? 'primary.main' : isReady ? '#059669' : MUTED;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        maxHeight: '100dvh',
        bgcolor: BG,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: { xs: 2, md: 3 },
          py: 1.75,
          borderBottom: `1px solid ${BORDER}`,
          bgcolor: 'background.paper',
          flexShrink: 0,
          boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
        }}
      >
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: 2,
            background: BRAND_GRADIENT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(197,160,34,0.25)',
          }}
        >
          {isSpeaking ? (
            <motion.div animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 0.8, repeat: Infinity }}>
              <GraphicEqIcon sx={{ fontSize: 20, color: PRIMARY_CONTRAST }} />
            </motion.div>
          ) : (
            <SmartToyIcon sx={{ fontSize: 20, color: PRIMARY_CONTRAST }} />
          )}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>
            {constants.AI_ASSISTANT_TITLE || 'AI Assistant'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <motion.div
              animate={{ opacity: (isRecording || isProcessing || isSpeaking) ? [0.5, 1, 0.5] : 1 }}
              transition={{ duration: 1, repeat: Infinity }}
              style={{ width: 6, height: 6, borderRadius: '50%', background: isReady ? (isRecording ? '#DC2626' : isProcessing || isSpeaking ? '#D4AF37' : '#059669') : '#888' }}
            />
            <Typography sx={{ fontSize: 11, color: headerStateColor }}>
              {headerState}
            </Typography>
          </Box>
        </Box>
        <Chip
          label={ROLE_LABELS[account?.role] || account?.role}
          size="small"
          sx={{ fontSize: 10, height: 20, fontWeight: 600, bgcolor: 'action.hover', color: 'text.secondary' }}
        />
      </Box>

      {/* Messages */}
      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: { xs: 2, md: 4 },
          py: 2.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': { borderRadius: 2, bgcolor: BORDER },
        }}
      >
        {/* Empty state */}
        {messages.length === 0 && !streamingContent && (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, py: 6 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 56, height: 56, borderRadius: 3, background: BRAND_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(197,160,34,0.3)' }}>
                <SmartToyIcon sx={{ fontSize: 28, color: PRIMARY_CONTRAST }} />
              </Box>
              <Typography sx={{ fontWeight: 700, fontSize: 16, mt: 0.5 }}>
                {constants.AI_ASSISTANT_TITLE || 'AI Assistant'}
              </Typography>
              <Typography sx={{ fontSize: 13, color: MUTED, textAlign: 'center', maxWidth: 300 }}>
                Ask me anything — I can help with requests, bookings, stats, and more.
              </Typography>
            </Box>
            {suggestions.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', maxWidth: 480 }}>
                {suggestions.map((s) => (
                  <Chip
                    key={s}
                    label={s}
                    onClick={() => handleSend(s)}
                    size="small"
                    sx={{
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 500,
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

        {/* Message list with date separators */}
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
            style={{ alignSelf: 'flex-start', maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ width: 20, height: 20, borderRadius: 1, background: BRAND_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SmartToyIcon sx={{ fontSize: 12, color: PRIMARY_CONTRAST }} />
              </Box>
              <Typography sx={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {constants.AI_ASSISTANT_TITLE || 'AI Assistant'}
              </Typography>
            </Box>
            <Box sx={{ px: 2, py: 1.25, borderRadius: '4px 16px 16px 16px', border: `1px solid ${BORDER}`, boxShadow: SHADOW, bgcolor: 'background.paper', fontSize: 14, lineHeight: 1.6, '& p': { m: 0 }, '& ul, & ol': { m: 0, pl: 2 } }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent + ' ▍'}</ReactMarkdown>
            </Box>
          </motion.div>
        )}
      </Box>

      {/* Input bar */}
      <Box
        sx={{
          px: { xs: 2, md: 4 },
          py: 1.75,
          borderTop: `1px solid ${BORDER}`,
          bgcolor: 'background.paper',
          flexShrink: 0,
        }}
      >
        {isRecording && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25, px: 0.5 }}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <motion.div
                key={i}
                style={{ flex: 1, height: 3, borderRadius: 99, background: '#DC2626', transformOrigin: 'center' }}
                animate={{ scaleY: [0.3, 1 + Math.random() * 2, 0.3] }}
                transition={{ duration: 0.4 + i * 0.05, repeat: Infinity, ease: 'easeInOut', delay: i * 0.06 }}
              />
            ))}
            <Typography sx={{ fontSize: 11, color: '#DC2626', ml: 1, fontWeight: 600, whiteSpace: 'nowrap' }}>Listening…</Typography>
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-end' }}>
          <MicButton
            isRecording={isRecording}
            isReady={isReady}
            isProcessing={isProcessing}
            isSpeaking={isSpeaking}
            onClick={() => isRecording ? stopRecording() : startRecording()}
          />
          <TextField
            inputRef={inputRef}
            fullWidth
            multiline
            maxRows={4}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? 'Listening…' : 'Ask anything…'}
            disabled={!isReady || isRecording}
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
                fontSize: 14,
                bgcolor: BG,
                transition: 'border-color 0.2s',
                '& fieldset': { borderColor: BORDER },
                '&:hover fieldset': { borderColor: 'primary.main' },
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
                      width: 30,
                      height: 30,
                      borderRadius: 1.5,
                      background: input.trim() && isReady && !isSending ? BRAND_GRADIENT : 'transparent',
                      color: input.trim() && isReady && !isSending ? PRIMARY_CONTRAST : MUTED,
                      transition: 'all 0.2s',
                      '&.Mui-disabled': { opacity: 0.3 },
                    }}
                  >
                    <SendIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}
