import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Box, Typography, TextField, IconButton, InputAdornment, Chip } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import SendIcon from '@mui/icons-material/Send';
import AddIcon from '@mui/icons-material/Add';
import HistoryIcon from '@mui/icons-material/History';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { BORDER, SHADOW, BRAND_GRADIENT, PRIMARY_CONTRAST, MUTED, NAVY, BG } from '../../theme';
import { useSocketAllRounder } from '../AllRounder/hooks/useSocketAllRounder';
import { ChatBubble, ThinkingBubble, useAutoScroll, mapDbMessages } from '../AllRounder/AllRounderChatComponents';
import constants from '../../constants.json';

const GUEST_SUGGESTIONS = constants.CONCIERGE_SUGGESTIONS || [];

const BOTTOM_NAV_H = '7.5dvh';
const INPUT_BAR_H = '7dvh';

export default function GuestAssistant({ navigate, alertError }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);

  // Main back button closes history panel via popstate
  useEffect(() => {
    if (!showHistory) return;
    window.history.pushState({ chatHistory: true }, '');
    const onPop = () => setShowHistory(false);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [showHistory]);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const addMessage = useCallback((role, content, cards = [], options = []) => {
    setMessages((prev) => [...prev, { role, content, cards, options, id: Date.now() + Math.random(), createdAt: new Date().toISOString() }]);
  }, []);

  const { isReady, isRecording, isProcessing, isSpeaking, isSending, sendMessage, newChat, listChats, switchChat, startRecording, stopRecording } = useSocketAllRounder({
    onReady: (dbMessages) => {
      if (dbMessages?.length) setMessages(mapDbMessages(dbMessages));
    },
    onStreamChunk: (chunk) => setStreamingContent((prev) => prev + chunk),
    onStreamEnd: ({ content, cards, options }) => { setStreamingContent(''); addMessage('assistant', content, cards, options); },
    onUserMessage: (text) => addMessage('user', text),
    onVoiceTextEnd: ({ text, cards }) => addMessage('assistant', text, cards),
    onError: (err) => alertError?.(err),
    onChatCreated: () => { setMessages([]); setStreamingContent(''); setShowHistory(false); },
    onChatsList: (chats) => { setChatHistory(chats); setShowHistory(true); },
    onChatSwitched: (chatId, msgs) => {
      setMessages(mapDbMessages(msgs));
      setStreamingContent('');
      setShowHistory(false);
    },
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
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: `calc(100dvh - ${BOTTOM_NAV_H})`, bgcolor: BG, pb: `calc(${INPUT_BAR_H} + env(safe-area-inset-bottom, 0px))` }}>
      {/* Header */}
      <Box sx={{ px: 2, pt: 2, pb: 1.25, display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box sx={{ width: 30, height: 30, borderRadius: 1.5, background: BRAND_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(197,160,34,0.3)' }}>
          <SmartToyIcon sx={{ fontSize: 16, color: PRIMARY_CONTRAST }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>
            {constants.AI_ASSISTANT_TITLE}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <motion.div
              animate={{ opacity: (isRecording || isProcessing || isSpeaking) ? [0.5, 1, 0.5] : 1 }}
              transition={{ duration: 0.8, repeat: Infinity }}
              style={{ width: 5, height: 5, borderRadius: '50%', background: isReady ? (isRecording ? '#DC2626' : isProcessing || isSpeaking ? '#D4AF37' : '#059669') : '#888' }}
            />
            <Typography sx={{ fontSize: 10, color: MUTED }}>
              {isRecording ? 'Listening…' : isProcessing ? 'Thinking…' : isSpeaking ? 'Speaking…' : isReady ? 'Ready' : 'Connecting…'}
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={() => listChats()} sx={{ color: NAVY, '&:hover': { color: 'primary.main' } }} title="Chat history">
          <HistoryIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={() => newChat()} sx={{ color: NAVY, '&:hover': { color: 'primary.main' } }} title="New chat">
          <AddIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* History panel */}
      {showHistory && (
        <Box sx={{ flex: 1, overflowY: 'auto', bgcolor: BG, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ px: 2, py: 1.25, borderBottom: `1px solid ${BORDER}` }}>
            <Typography sx={{ fontWeight: 600, fontSize: 14, color: NAVY }}>Chat history</Typography>
          </Box>
          {chatHistory.length === 0 ? (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', pt: 4 }}>
              <Typography sx={{ fontSize: 13, color: MUTED }}>No previous chats</Typography>
            </Box>
          ) : (
            chatHistory.map((chat) => (
              <Box key={chat.id} onClick={() => switchChat(chat.id)}
                sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, transition: 'background 0.15s' }}>
                <Typography sx={{ fontSize: 13, fontWeight: 500, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {chat.preview}
                </Typography>
                <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
                  {new Date(chat.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Typography>
              </Box>
            ))
          )}
        </Box>
      )}

      {/* Messages */}
      {!showHistory && <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 2,
          py: 0.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {/* Empty state */}
        {messages.length === 0 && !streamingContent && (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2.5, py: 5 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 48, height: 48, borderRadius: 2.5, background: BRAND_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(197,160,34,0.3)' }}>
                <SmartToyIcon sx={{ fontSize: 24, color: PRIMARY_CONTRAST }} />
              </Box>
              <Typography sx={{ fontSize: 13, color: MUTED, textAlign: 'center', mt: 0.5 }}>
                How can I help you today?
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, justifyContent: 'center' }}>
              {GUEST_SUGGESTIONS.map((s) => (
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
                    '&:hover': { bgcolor: 'rgba(212,175,55,0.08)', borderColor: 'primary.main' },
                    transition: 'all 0.15s',
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} navigate={navigate} onOptionSelect={handleSend} />
          ))}
        </AnimatePresence>
        {showThinking && <ThinkingBubble />}
        {streamingContent && (
          <Box sx={{ alignSelf: 'flex-start', maxWidth: '84%', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 18, height: 18, borderRadius: 0.75, background: BRAND_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SmartToyIcon sx={{ fontSize: 11, color: PRIMARY_CONTRAST }} />
              </Box>
              <Typography sx={{ fontSize: 10, fontWeight: 600, color: MUTED, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {constants.AI_ASSISTANT_TITLE}
              </Typography>
            </Box>
            <Box sx={{ px: 1.75, py: 1, borderRadius: '4px 14px 14px 14px', border: `1px solid ${BORDER}`, bgcolor: 'background.paper', boxShadow: SHADOW, fontSize: 13.5, lineHeight: 1.55, '& p': { m: 0 } }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent + ' ▍'}</ReactMarkdown>
            </Box>
          </Box>
        )}
      </Box>}

      {/* Input bar — hidden on history screen */}
      <Box
        sx={{
          display: showHistory ? 'none' : 'flex',
          position: 'fixed',
          bottom: BOTTOM_NAV_H,
          left: 0,
          right: 0,
          px: 2,
          py: 1.25,
          bgcolor: 'background.paper',
          borderTop: `1px solid ${BORDER}`,
          flexDirection: 'column',
          gap: isRecording ? 1 : 0,
          zIndex: 10,
        }}
      >
        {isRecording && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 0.5 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <motion.div
                key={i}
                style={{ flex: 1, height: 3, borderRadius: 99, background: '#DC2626' }}
                animate={{ scaleY: [0.3, 1.8, 0.3] }}
                transition={{ duration: 0.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.07 }}
              />
            ))}
            <Typography sx={{ fontSize: 10, color: '#DC2626', ml: 0.5, fontWeight: 600, whiteSpace: 'nowrap' }}>Listening…</Typography>
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          {/* Mic with pulse */}
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
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
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
    </Box>
  );
}
