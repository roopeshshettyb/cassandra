import React, { useState, useRef, useEffect } from 'react';
import { Box, TextField, IconButton, Typography, Paper } from '@mui/material';
import { Send } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import request from '../helper/api';

const MotionPaper = motion(Paper);

function ChatInterface({ sessionId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadMessages();
  }, [sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    await request({
      endpoint: `/chat/messages?sessionId=${sessionId}`,
      method: 'GET',
      setData: (data) => setMessages(data.messages || []),
    });
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');

    // Optimistically add user message
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);

    await request({
      endpoint: '/chat',
      method: 'POST',
      data: {
        message: userMessage,
        sessionId,
      },
      setLoading,
      setData: (data) => {
        if (data?.response) {
          setMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);
        }
      },
      alertError: (error) => {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error.' }]);
      },
    });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '500px',
        bgcolor: 'background.paper',
        borderRadius: 2,
        boxShadow: 3,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6">Chat with Cassandra</Typography>
      </Box>

      {/* Messages */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <AnimatePresence>
          {messages.map((msg, index) => (
            <MotionPaper
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              sx={{
                p: 1.5,
                maxWidth: '75%',
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                bgcolor: msg.role === 'user' ? 'primary.main' : 'grey.200',
                color: msg.role === 'user' ? 'white' : 'text.primary',
              }}
            >
              <Typography variant="body2">{msg.content}</Typography>
            </MotionPaper>
          ))}
        </AnimatePresence>
        {loading && (
          <MotionPaper initial={{ opacity: 0 }} animate={{ opacity: 1 }} sx={{ p: 1.5, maxWidth: '75%', bgcolor: 'grey.200' }}>
            <Typography variant="body2">Typing...</Typography>
          </MotionPaper>
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Input */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1 }}>
        <TextField fullWidth size="small" placeholder="Type a message..." value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={handleKeyPress} disabled={loading} />
        <IconButton color="primary" onClick={sendMessage} disabled={loading || !input.trim()}>
          <Send />
        </IconButton>
      </Box>
    </Box>
  );
}

export default ChatInterface;
