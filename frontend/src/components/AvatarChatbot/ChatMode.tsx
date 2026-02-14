import React, { useState, useRef, useEffect } from 'react';
import { Box, Button, IconButton, Typography, TextField, Fade, Paper, CircularProgress, Slide } from '@mui/material';
import { cn } from '../../helper/utils';
import SendIcon from '@mui/icons-material/Send';
import MessageIcon from '@mui/icons-material/Message';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import { Message } from './types';

interface ChatModeProps {
  onSwitchToVoice: () => void;
  isVoiceSupported: boolean;
  theme: 'light' | 'dark';
  bookingId: number;
  messages: Message[];
  sendMessage: (content: string) => Promise<string | null>;
  isLoading: boolean;
  error: string | null;
}

export const ChatMode: React.FC<ChatModeProps> = ({
  onSwitchToVoice,
  isVoiceSupported,
  theme,
  bookingId,
  messages,
  sendMessage,
  isLoading,
  error,
}) => {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');
    await sendMessage(message);
    inputRef.current?.focus();
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isDark = theme === 'dark';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'transparent', position: 'relative' }}>
      {/* Messages */}
      <Box
        ref={scrollRef}
        sx={{
          flex: 1, px: 2, py: 3, overflowY: 'auto',
          '&::-webkit-scrollbar': { width: '6px' },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': { background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderRadius: '3px' },
          '&::-webkit-scrollbar-thumb:hover': { background: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }
        }}
      >
        <Box sx={{ maxWidth: '800px', mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {messages.map((message) => (
            <Slide direction="up" in={true} mountOnEnter unmountOnExit key={message.id}>
              <Box sx={{ display: 'flex', justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <Paper sx={{
                  maxWidth: '85%', borderRadius: '1.25rem', px: 2.5, py: 1.5, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  backdropFilter: 'blur(12px)', transition: 'all 0.2s',
                  bgcolor: message.role === 'user' ? '#2563eb' : (isDark ? 'rgba(0,0,0,0.4)' : 'white'),
                  border: message.role === 'user' ? '1px solid #2563eb' : (isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.05)'),
                  color: message.role === 'user' ? 'white' : (isDark ? 'rgba(255,255,255,0.9)' : 'text.primary'),
                  borderBottomRightRadius: message.role === 'user' ? 0 : '1.25rem',
                  borderBottomLeftRadius: message.role !== 'user' ? 0 : '1.25rem',
                }}>
                  <Typography variant="body1" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {message.content}
                  </Typography>
                  <Typography variant="caption" sx={{
                    display: 'block', mt: 1, fontSize: '0.625rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.7,
                    textAlign: message.role === 'user' ? 'right' : 'left',
                    color: message.role === 'user' ? 'rgba(255,255,255,0.8)' : (isDark ? 'rgba(255,255,255,0.5)' : 'text.secondary')
                  }}>
                    {formatTime(message.timestamp)}
                  </Typography>
                </Paper>
              </Box>
            </Slide>
          ))}

          {isLoading && (
            <Slide direction="up" in={true} mountOnEnter unmountOnExit>
              <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                <Paper sx={{
                  bgcolor: isDark ? 'rgba(0,0,0,0.3)' : 'white',
                  backdropFilter: 'blur(12px)',
                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.05)',
                  borderRadius: '1.25rem', borderBottomLeftRadius: 0, px: 2.5, py: 2, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Box sx={{ width: 6, height: 6, bgcolor: '#3b82f6', borderRadius: '50%', animation: 'bounce 1s infinite', animationDelay: '-0.3s' }} />
                      <Box sx={{ width: 6, height: 6, bgcolor: '#3b82f6', borderRadius: '50%', animation: 'bounce 1s infinite', animationDelay: '-0.15s' }} />
                      <Box sx={{ width: 6, height: 6, bgcolor: '#3b82f6', borderRadius: '50%', animation: 'bounce 1s infinite' }} />
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Processing</Typography>
                  </Box>
                </Paper>
              </Box>
            </Slide>
          )}

          {error && (
            <Box sx={{ maxWidth: '300px', mx: 'auto', textAlign: 'center', p: 1.5, borderRadius: '0.75rem', bgcolor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', backdropFilter: 'blur(12px)' }}>
              <Typography variant="caption" sx={{ color: '#ef4444', fontWeight: 500 }}>{error}</Typography>
            </Box>
          )}

          <div ref={messagesEndRef} />
        </Box>
      </Box>
    </Box>
  );
};
