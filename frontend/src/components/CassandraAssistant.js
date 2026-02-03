import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box, IconButton, Typography, TextField, Paper } from '@mui/material';
import { Mic, MicOff, Chat, VoiceOverOff, Send, Message } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import io from 'socket.io-client';
import request from '../helper/api';

const MotionPaper = motion(Paper);
const MotionBox = motion(Box);

function CassandraAssistant({ sessionId }) {
  const [mode, setMode] = useState('voice'); // 'voice' or 'chat'
  const modeRef = useRef('voice');
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState('Ready');

  const socketRef = useRef(null);
  const playbackContextRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);

  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const processorRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Initialize Socket and Audio on Mount
  useEffect(() => {
    playbackContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    socketRef.current = io(process.env.REACT_APP_BACKEND_URL);

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Connected to Cassandra server');
      socket.emit('start-session', { token: sessionStorage.getItem('token'), sessionId });
    });

    socket.on('openai-message', (message) => {
      // Handle audio delta - ONLY if in voice mode
      if (message.type === 'response.audio.delta' && message.delta && modeRef.current === 'voice') {
        queueAudio(message.delta);
      }

      // Handle transcriptions for chat UI
      if (message.type === 'conversation.item.input_audio_transcription.completed') {
        setMessages((prev) => [...prev, { role: 'user', content: message.transcript }]);
      }
      if (message.type === 'response.audio_transcript.done') {
        setMessages((prev) => [...prev, { role: 'assistant', content: message.transcript }]);
      }

      // Handle direct text responses (for text input)
      if (message.type === 'response.text.done') {
        setMessages((prev) => [...prev, { role: 'assistant', content: message.text }]);
      }

      if (message.type === 'response.done') {
        setStatus('Ready');
      }
    });

    loadHistory();

    return () => {
      socket.disconnect();
      if (playbackContextRef.current) playbackContextRef.current.close();
      stopListening();
    };
  }, [sessionId]);

  useEffect(() => {
    if (mode === 'chat' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [messages, mode]);

  const loadHistory = async () => {
    await request({
      endpoint: `/chat/messages?sessionId=${sessionId}`,
      method: 'GET',
      setData: (data) => setMessages(data.messages || []),
    });
  };

  // Audio Playback Logic
  const queueAudio = (base64) => {
    audioQueueRef.current.push(base64);
    if (!isPlayingRef.current) playNextAudio();
  };

  const playNextAudio = async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    // Safety check: if mode switched to chat mid-playback, stop playing
    if (modeRef.current !== 'voice') {
      audioQueueRef.current = [];
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const base64 = audioQueueRef.current.shift();
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7fff);

      const buffer = playbackContextRef.current.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);

      const source = playbackContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(playbackContextRef.current.destination);

      const startTime = Math.max(playbackContextRef.current.currentTime, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + buffer.duration;
      source.onended = () => playNextAudio();
    } catch (err) {
      console.error('Audio play error', err);
      playNextAudio();
    }
  };

  // Microphone Logic
  const startListening = async () => {
    try {
      setIsListening(true);
      setStatus('Listening...');
      audioQueueRef.current = [];
      isPlayingRef.current = false;
      nextPlayTimeRef.current = 0;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      processorRef.current.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);

        // Convert to PCM16
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const val = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = val < 0 ? val * 0x8000 : val * 0x7fff;
        }

        // Convert to Base64
        let binary = '';
        const bytes = new Uint8Array(pcm16.buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Audio = btoa(binary);

        socketRef.current.emit('audio-data', base64Audio);
      };

      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
    } catch (err) {
      console.error('Mic error', err);
      setIsListening(false);
      setStatus('Mic denied');
    }
  };

  const stopListening = () => {
    setIsListening(false);
    setStatus('Ready');
    socketRef.current?.emit('commit-audio');
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  };

  const handleSendText = () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    socketRef.current.emit('send-text', { text });
    setInputText('');
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 500, mx: 'auto' }}>
      <Paper
        sx={{
          p: 2,
          height: mode === 'voice' ? 400 : 550,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 3,
          boxShadow: (theme) => (theme.palette.mode === 'dark' ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.1)'),
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          transition: 'height 0.3s ease',
        }}
      >
        {/* Top Right Toggle Button */}
        <IconButton sx={{ position: 'absolute', top: 12, right: 12, zIndex: 10, bgcolor: 'action.hover' }} onClick={() => setMode(mode === 'voice' ? 'chat' : 'voice')}>
          {mode === 'voice' ? <Chat sx={{ color: 'primary.main' }} /> : <Mic sx={{ color: 'primary.main' }} />}
        </IconButton>

        <AnimatePresence mode="wait">
          {mode === 'voice' ? (
            <MotionBox
              key="voice"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
            >
              <Box sx={{ position: 'relative', mb: 3 }}>
                {isListening && (
                  <MotionBox
                    initial={{ scale: 0.8, opacity: 0.5 }}
                    animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    sx={{ position: 'absolute', top: -20, left: -20, right: -20, bottom: -20, borderRadius: '50%', bgcolor: 'primary.main', opacity: 0.2, zIndex: 0 }}
                  />
                )}
                <IconButton
                  onClick={isListening ? stopListening : startListening}
                  sx={{
                    width: 140,
                    height: 140,
                    bgcolor: isListening ? 'error.main' : 'primary.main',
                    color: isListening ? 'white' : 'common.black',
                    '&:hover': { bgcolor: isListening ? 'error.dark' : 'primary.dark' },
                    zIndex: 1,
                    boxShadow: 6,
                  }}
                >
                  {isListening ? <MicOff sx={{ fontSize: 70 }} /> : <Mic sx={{ fontSize: 70 }} />}
                </IconButton>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
                {isListening ? 'Cassandra is listening...' : 'Click to talk to Cassandra'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {status}
              </Typography>
            </MotionBox>
          ) : (
            <MotionBox
              key="chat"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              sx={{ flex: 1, display: 'flex', flexDirection: 'column', pt: 5 }}
            >
              <Box sx={{ flex: 1, overflowY: 'auto', px: 1, mb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {messages.map((m, i) => (
                  <MotionBox
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    sx={{
                      p: 1.5,
                      maxWidth: '85%',
                      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                      bgcolor: m.role === 'user' ? 'primary.main' : 'action.selected',
                      color: m.role === 'user' ? 'common.black' : 'text.primary',
                      borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      boxShadow: 1,
                    }}
                  >
                    <Typography variant="body2" sx={{ fontSize: '0.95rem' }}>
                      {m.content}
                    </Typography>
                  </MotionBox>
                ))}
                <div ref={messagesEndRef} />
              </Box>

              <Box sx={{ display: 'flex', gap: 1, p: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Type a message..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendText()}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
                <IconButton
                  color="primary"
                  onClick={handleSendText}
                  disabled={!inputText.trim()}
                  sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { bgcolor: 'action.disabledBackground' } }}
                >
                  <Send />
                </IconButton>
              </Box>
            </MotionBox>
          )}
        </AnimatePresence>
      </Paper>
    </Box>
  );
}

export default CassandraAssistant;
