import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Box, Button, CircularProgress, IconButton, TextField, Typography } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import { io } from 'socket.io-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { keyframes } from '@mui/system';
import constants from '../constants.json';

const { APP_NAME } = constants;

const getBackendUrl = () => (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');

const pulseWave = keyframes({
  '0%': {
    transform: 'scaleY(1)',
    opacity: 0.7,
  },
  '50%': {
    transform: 'scaleY(1.3)',
    opacity: 1,
  },
  '100%': {
    transform: 'scaleY(1)',
    opacity: 0.7,
  },
});

function ChatBox({ bookingId, alertError }) {
  const [socket, setSocket] = useState(null);
  const [ready, setReady] = useState(false);
  const [voiceSocket, setVoiceSocket] = useState(null);
  const [voiceReady, setVoiceReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [sending, setSending] = useState(false);
  const [connectionNote, setConnectionNote] = useState('');
  const inputRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const voiceSocketRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const processorRef = useRef(null);
  const playbackAudioContextRef = useRef(null);
  const playbackTimeRef = useRef(0);
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
      alertError?.(`Please log in to talk to ${APP_NAME}`);
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

  // Voice socket on /voice namespace
  useEffect(() => {
    if (!bookingId || isNaN(bookingId)) return;
    const token = localStorage.getItem('token');
    if (!token) {
      return;
    }

    const connectUrl = getBackendUrl();
    if (!connectUrl) {
      return;
    }

    const voiceInstance = io(`${connectUrl}/voice`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      query: { token, bookingId: String(bookingId) },
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 500,
      reconnectionDelayMax: 8000,
      randomizationFactor: 0.2,
    });

    voiceSocketRef.current = voiceInstance;
    setVoiceSocket(voiceInstance);

    voiceInstance.on('connect', () => {
      setVoiceReady(false);
    });

    voiceInstance.on('disconnect', () => {
      setVoiceReady(false);
      setIsRecording(false);
    });

    voiceInstance.on('auth_required', () => {
      voiceInstance.emit('auth', { token, bookingId });
    });

    voiceInstance.on('ready', () => {
      // Auth OK for voice namespace.
      setVoiceReady(true);
    });

    voiceInstance.on('voice_ready', () => {
      setVoiceReady(true);
    });

    voiceInstance.on('voice_text_chunk', (payload) => {
      setStreamingContent((prev) => prev + (payload.delta || ''));
    });

    voiceInstance.on('voice_text_end', (payload) => {
      const text = payload?.text || '';
      const toolCalls = payload?.toolCalls || [];
      setStreamingContent('');
      if (text) {
        setMessages((prev) => [...prev, { id: `assistant-voice-${Date.now()}`, role: 'assistant', content: text, createdAt: new Date().toISOString(), toolCalls }]);
      }
      setSending(false);
      focusInput();
    });

    voiceInstance.on('voice_user_message', (payload) => {
      const text = payload?.text || '';
      if (!text.trim()) return;
      setMessages((prev) => [
        ...prev,
        {
          id: `user-voice-${Date.now()}`,
          role: 'user',
          content: text,
          createdAt: new Date().toISOString(),
        },
      ]);
    });

    voiceInstance.on('voice_audio_chunk', (payload) => {
      const delta = payload?.delta;
      if (!delta) return;
      playPcmChunk(delta, playbackAudioContextRef, playbackTimeRef);
    });

    voiceInstance.on('voice_audio_end', () => {
      // Nothing special to do; playback is fire-and-forget.
    });

    voiceInstance.on('error', (payload) => {
      setStreamingContent('');
      setSending(false);
      alertError?.(payload?.message || 'Something went wrong with voice');
      focusInput();
    });

    voiceInstance.on('connect_error', (err) => {
      alertError?.(err?.message || 'Voice connection failed');
    });

    return () => {
      voiceInstance.removeAllListeners();
      voiceInstance.disconnect();
      voiceSocketRef.current = null;
      setVoiceReady(false);
      setIsRecording(false);
    };
  }, [bookingId, alertError, focusInput]);

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

  const startRecording = async () => {
    if (isRecording) return;
    if (!voiceSocketRef.current?.connected || !voiceReady) {
      alertError?.('Voice connection is not ready yet');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextImpl = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextImpl({ sampleRate: 24000 });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm = floatTo16BitPCM(inputData);
        const base64 = arrayBufferToBase64(pcm.buffer);
        if (voiceSocketRef.current?.connected) {
          voiceSocketRef.current.emit('voice_client_chunk', { audio: base64 });
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      audioContextRef.current = audioContext;
      mediaStreamRef.current = stream;
      processorRef.current = processor;
      setIsRecording(true);
    } catch (err) {
      alertError?.(err?.message || 'Could not access microphone');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
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
    setIsRecording(false);
  };

  const handleVoice = async () => {
    if (!voiceSocketRef.current?.connected || !voiceReady) {
      alertError?.('Voice is not ready yet');
      return;
    }
    if (isRecording) {
      // Stop current turn.
      stopRecording();
      voiceSocketRef.current.emit('voice_stop');
      return;
    }
    // Start a new voice turn.
    voiceSocketRef.current.emit('voice_start');
    await startRecording();
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
        {!streamingContent && sending && (
          <Box
            sx={{
              alignSelf: 'flex-start',
              maxWidth: '85%',
              px: 2,
              py: 1.5,
              borderRadius: 2,
              bgcolor: 'action.hover',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              {APP_NAME} is thinking…
            </Typography>
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
        <IconButton
          color={isRecording ? 'secondary' : 'primary'}
          onClick={handleVoice}
          disabled={!ready || !voiceReady}
          aria-label="Voice"
          sx={{
            transition: 'transform 0.2s ease, opacity 0.2s ease',
            transform: isRecording ? 'scale(1.15)' : 'scale(1)',
            opacity: !ready || !voiceReady ? 0.4 : 1,
          }}
        >
          <GraphicEqIcon
            sx={{
              animation: isRecording ? `${pulseWave} 0.9s ease-in-out infinite` : 'none',
            }}
          />
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
        <Typography variant="h6">{APP_NAME} will help you with this booking</Typography>
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

// Helpers for audio encoding/decoding.
const floatTo16BitPCM = (input) => {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < input.length; i += 1, offset += 2) {
    let s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Int16Array(buffer);
};

const arrayBufferToBase64 = (buffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const base64ToUint8Array = (base64) => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const playPcmChunk = (base64, audioContextRef, playbackTimeRef) => {
  const bytes = base64ToUint8Array(base64);
  const AudioContextImpl = window.AudioContext || window.webkitAudioContext;
  if (!audioContextRef.current) {
    audioContextRef.current = new AudioContextImpl({ sampleRate: 24000 });
  }
  const audioContext = audioContextRef.current;
  const bufferLength = bytes.byteLength / 2;
  const audioBuffer = audioContext.createBuffer(1, bufferLength, 24000);
  const channelData = audioBuffer.getChannelData(0);
  const dataView = new DataView(bytes.buffer);
  for (let i = 0; i < bufferLength; i += 1) {
    const sample = dataView.getInt16(i * 2, true);
    channelData[i] = sample / 0x8000;
  }
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  const now = audioContext.currentTime;
  const startAt = Math.max(playbackTimeRef.current || now, now);
  source.start(startAt);
  playbackTimeRef.current = startAt + audioBuffer.duration;
};

export default ChatBox;
