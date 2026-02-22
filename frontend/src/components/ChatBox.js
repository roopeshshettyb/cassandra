import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Box, Button, CircularProgress, IconButton, TextField, Typography, Paper, Tooltip, Fade } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';

import ChatIcon from '@mui/icons-material/Chat';
import { io } from 'socket.io-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { keyframes } from '@mui/system';
import constants from '../constants.json';

// Imports for Voice Mode (3D Avatar)
import { AvatarCanvas } from './AvatarChatbot/AvatarCanvas';
import { useSocketChat } from './AvatarChatbot/hooks/useSocketChat';
import { useLipSync } from './AvatarChatbot/hooks/useLipSync';

import { DEFAULT_AVATAR_CONFIG } from '../config/default-avatar-config';

const { APP_NAME } = constants;

const getBackendUrl = () => (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');

const pulseWave = keyframes({
  '0%': { transform: 'scaleY(1)', opacity: 0.7 },
  '50%': { transform: 'scaleY(1.3)', opacity: 1 },
  '100%': { transform: 'scaleY(1)', opacity: 0.7 },
});

// --- Classic Chat Component (The Original UI) ---
function ClassicChatBox({ bookingId, alertError, isWithinStay, onSwitchToVoice, isMobile, containerHeight = '75vh' }) {
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
    setTimeout(() => {
      inputRef.current?.focus?.();
    }, 0);
  }, []);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
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
    if (!bookingId || isNaN(bookingId) || !isWithinStay) return;
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
    const socketInstance = io(`${connectUrl}/chat`, {
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

    socketRef.current = socketInstance;
    setSocket(socketInstance);

    socketInstance.on('connect', () => setConnectionNote(''));
    socketInstance.on('disconnect', () => {
      setReady(false);
      setConnectionNote('Disconnected. Reconnecting…');
    });
    socketInstance.io.on('reconnect_attempt', (attempt) => setConnectionNote(`Reconnecting… (${attempt}/5)`));
    socketInstance.io.on('reconnect', () => setConnectionNote(''));
    socketInstance.io.on('reconnect_failed', () => setConnectionNote('Could not reconnect.'));

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
        setTimeout(() => scrollToBottom('auto'), 0);
        focusInput();
      }
    });

    socketInstance.on('auth_required', () => socketInstance.emit('auth', { token, bookingId }));
    socketInstance.on('stream_chunk', (payload) => setStreamingContent((prev) => prev + (payload.content || '')));
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
    socketInstance.on('connect_error', (err) => alertError?.(err?.message || 'Connection failed'));

    return () => {
      socketInstance.removeAllListeners();
      socketInstance.disconnect();
      socketRef.current = null;
    };
  }, [bookingId, alertError, focusInput, scrollToBottom, isWithinStay]);

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

  if (!bookingId || isNaN(bookingId)) return null;

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
          '& pre': { m: 0, p: 1, overflow: 'auto', borderRadius: 1, bgcolor: isUser ? 'rgba(255, 0, 0, 0.18)' : 'action.hover' },
          '& :not(pre) > code': { px: 0.6, py: 0.2, borderRadius: 0.8, bgcolor: isUser ? 'rgba(255,255,255,0.16)' : 'action.hover' },
        }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || ''}</ReactMarkdown>
      </Box>
    );
  };

  const chatInner = (
    <>
      <Box ref={scrollContainerRef} onScroll={handleScroll} sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
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
        {streamingContent && <Box sx={{ alignSelf: 'flex-start', maxWidth: '85%', px: 2, py: 1, borderRadius: 2, bgcolor: 'action.hover' }}>{renderMarkdown(streamingContent)}</Box>}
        {!streamingContent && sending && (
          <Box sx={{ alignSelf: 'flex-start', maxWidth: '85%', px: 2, py: 1.5, borderRadius: 2, bgcolor: 'action.hover', display: 'inline-flex', alignItems: 'center', gap: 1 }}>
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

        <Button variant="contained" onClick={handleSend} disabled={!ready || sending || !input.trim()} endIcon={<SendIcon />}>
          Send
        </Button>
      </Box>
    </>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WordByWordText variant="h6" text={`${APP_NAME} will help you with this booking`} />
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

        {/* Switch Mode Button (Restored) */}
        <Tooltip title="Switch to Voice Mode">
          <IconButton
            size="small"
            onClick={() => onSwitchToVoice && onSwitchToVoice()}
            aria-label="Switch to Voice Mode"
            sx={{
              color: 'primary.main',
              transition: 'transform 0.2s ease-in-out',
              '&:hover': {
                transform: 'scale(1.2)',
                bgcolor: 'transparent',
              },
            }}
          >
            <GraphicEqIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: 1, borderColor: 'divider', borderRadius: 2 }}>{chatInner}</Box>
    </Box>
  );
}
// --- Waveform Component ---
// --- Waveform Component ---
const Waveform = ({ isActive, color, analyser }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let phase = 0;
    const numWaves = 3;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let averageAmplitude = 0;
      if (isActive && analyser) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        const count = Math.min(bufferLength, 20);
        for (let i = 0; i < count; i++) {
          sum += dataArray[i];
        }
        averageAmplitude = sum / count;
      }

      // Phase increment for animation speed
      phase += 0.05 + (averageAmplitude / 255) * 0.15;

      for (let n = 0; n < numWaves; n++) {
        const nFactor = n / (numWaves - 1 || 1);
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 - nFactor;
        ctx.globalAlpha = isActive ? 0.15 + (1 - nFactor) * 0.4 : 0.1;

        // Amplitude base and dynamic sensitivity
        const amplitudeScaling = isActive ? 4 + (averageAmplitude / 255) * 35 : 3;
        const frequency = 0.02 + n * 0.005;

        for (let x = 0; x < canvas.width; x++) {
          const envelope = Math.sin((x / (canvas.width - 1)) * Math.PI);
          const y = canvas.height / 2 + Math.sin(x * frequency + phase + n * 2) * amplitudeScaling * envelope;

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isActive, analyser, color]);

  // Helper for rounded rect
  const roundRect = (ctx, x, y, w, h, r) => {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  };

  // Fallback CSS animation if no analyser but active?
  // We'll stick to canvas if provided, else CSS fallback
  if (!analyser && isActive) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 60, mt: 2, width: '100%', overflow: 'hidden', position: 'relative' }}>
        <Box
          sx={{
            position: 'absolute',
            width: '100%',
            height: '2px',
            bgcolor: color,
            opacity: 0.15,
            animation: 'waveScroll 4s linear infinite',
            background: `linear-gradient(90deg, transparent, ${color}, transparent, ${color}, transparent)`,
          }}
        />
        <style>{`
          @keyframes waveScroll {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 60, mt: 2, width: '100%' }}>
      <canvas ref={canvasRef} width={400} height={60} style={{ width: '100%', maxWidth: '300px', height: '100%' }} />
    </Box>
  );
};

// --- WordByWordText Component for smooth reveal ---
const WordByWordText = ({ text, onComplete, variant = 'body1', sx = {} }) => {
  const [displayedText, setDisplayedText] = useState('');
  const words = text ? text.split(' ') : [];
  const currentIndex = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    // Reset if text changes significantly (e.g., new message)
    if (!text || !text.startsWith(displayedText)) {
      setDisplayedText('');
      currentIndex.current = 0;
    }

    const revealNextWord = () => {
      if (currentIndex.current < words.length) {
        const nextWord = words[currentIndex.current];
        if (nextWord !== undefined && nextWord !== null) {
          setDisplayedText((prev) => (prev ? `${prev} ${nextWord}` : nextWord));
        }
        currentIndex.current++;
        timerRef.current = setTimeout(revealNextWord, 60); // 60ms per word
      } else if (onComplete) {
        onComplete();
      }
    };

    if (timerRef.current) clearTimeout(timerRef.current);
    if (words.length > currentIndex.current) {
      revealNextWord();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text]);

  return (
    <Typography variant={variant} sx={{ fontWeight: 500, lineHeight: 1.4, ...sx }}>
      {displayedText}
    </Typography>
  );
};

// --- Voice Chat Component (The New 3D UI) ---
function VoiceChatBox({ bookingId, alertError, isWithinStay, onSwitchToChat, avatarConfig, isMobile, setLoading, autoStartVoice, onVoiceAutoStarted, guestName }) {
  // State defined above: messages...

  const avatarRef = useRef(null);
  const theme = useTheme();

  const { avatarUrl, idleAnimationPath, talkingAnimationPath, hiAnimationPath, thinkingAnimationPath } = avatarConfig || DEFAULT_AVATAR_CONFIG;

  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceReady, setVoiceReady] = useState(false);
  const [agentSubtitle, setAgentSubtitle] = useState('');
  const [userSubtitle, setUserSubtitle] = useState('');
  const agentSubtitleTimeoutRef = useRef(null);
  const userSubtitleTimeoutRef = useRef(null);

  // Voice socket refs (same pattern as ClassicChatBox)
  const voiceSocketRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const processorRef = useRef(null);
  const playbackAudioContextRef = useRef(null);
  const playbackTimeRef = useRef(0);
  const agentAnalyserRef = useRef(null);
  const userAnalyserRef = useRef(null);

  // Lip Sync Logic
  const { initWithSpeechSynthesis, initWithAnalyser } = useLipSync({
    onLipSyncUpdate: useCallback((value) => {
      if (avatarRef.current) {
        avatarRef.current.setLipSync(value);
      }
    }, []),
    smoothing: 0.5,
  });

  const lipSyncAnim = useRef(null);
  const realLipSyncRefs = useRef({ start: () => {}, stop: () => {}, isInitialized: false });

  useEffect(() => {
    // Fallback for TTS (non-server audio)
    lipSyncAnim.current = initWithSpeechSynthesis();
    return () => {
      if (lipSyncAnim.current) lipSyncAnim.current.stop();
      if (realLipSyncRefs.current) realLipSyncRefs.current.stop();
    };
  }, [initWithSpeechSynthesis]);

  // Chat socket for shared message history (text mode uses this)
  const { messages, isLoading, error, sendMessage, addMessage } = useSocketChat(bookingId);
  const prevIsLoading = useRef(isLoading);

  // Track if currently playing voice audio
  const isSpeakingVoiceRef = useRef(false);
  // Track last spoken message ID to prevent repeating TTS
  const lastSpokenMsgId = useRef('');
  // Guard to prevent "double voice" - tracks if server audio was received for current response
  const receivedServerAudioThisTurn = useRef(false);

  // Avatar animation based on loading state from chat socket
  useEffect(() => {
    if (isSpeakingVoiceRef.current) return; // Don't override voice animation
    if (isLoading) {
      avatarRef.current?.playThinking();
    } else if (prevIsLoading.current && !isLoading) {
      avatarRef.current?.playIdle();
    }
    prevIsLoading.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    // In voice mode, we prefer the server's realtime audio stream.
    // This effect should only trigger as a fallback or for initial context.
    if (isSpeakingVoiceRef.current || receivedServerAudioThisTurn.current) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant' || isLoading) return;
    if (lastSpokenMsgId.current === lastMsg.id) return; // Already spoken
    lastSpokenMsgId.current = lastMsg.id;

    const text = lastMsg.content;
    if (text && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onstart = () => {
        avatarRef.current?.playTalking();
        lipSyncAnim.current?.start();
      };
      utterance.onend = () => {
        avatarRef.current?.playIdle();
        lipSyncAnim.current?.stop();
      };
      window.speechSynthesis.speak(utterance);
    }
  }, [messages, isLoading]);

  // --- Voice Socket Connection ---
  useEffect(() => {
    if (!bookingId || isNaN(bookingId) || !isWithinStay) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    const connectUrl = getBackendUrl();
    if (!connectUrl) return;

    console.log('[VoiceChatBox] Connecting voice socket to:', `${connectUrl}/voice`);

    const voiceInstance = io(`${connectUrl}/voice`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      query: { token, bookingId: String(bookingId) },
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 500,
    });

    voiceSocketRef.current = voiceInstance;

    voiceInstance.on('connect', () => {
      console.log('[VoiceChatBox] Voice socket connected');
      setVoiceReady(false); // Wait for ready/voice_ready
    });
    voiceInstance.on('disconnect', () => {
      console.log('[VoiceChatBox] Voice socket disconnected');
      setVoiceReady(false);
      setIsRecording(false);
    });
    voiceInstance.on('auth_required', () => voiceInstance.emit('auth', { token, bookingId }));
    voiceInstance.on('ready', () => {
      console.log('[VoiceChatBox] Voice ready');
      setVoiceReady(true);
    });
    voiceInstance.on('voice_ready', () => {
      console.log('[VoiceChatBox] Voice ready (voice_ready)');
      setVoiceReady(true);
    });

    // When user's voice is transcribed by the backend
    voiceInstance.on('voice_user_message', (payload) => {
      const text = payload?.text || '';
      console.log('[VoiceChatBox] User transcription:', text);
      if (text.trim()) {
        addMessage({ id: `user-voice-${Date.now()}`, role: 'user', content: text, timestamp: new Date() });
        // Show thinking animation while waiting for response
        avatarRef.current?.playThinking();

        setUserSubtitle(text.length > 120 ? '...' + text.slice(-120) : text);
        if (userSubtitleTimeoutRef.current) clearTimeout(userSubtitleTimeoutRef.current);
        userSubtitleTimeoutRef.current = setTimeout(() => setUserSubtitle(''), 4000);
      }
    });

    // Voice response: text complete
    voiceInstance.on('voice_text_end', (payload) => {
      const text = payload?.text || '';
      console.log('[VoiceChatBox] Voice text end:', text.substring(0, 50) + '...');
      if (text) {
        // Add assistant response to shared message history
        const msgId = `assistant-voice-${Date.now()}`;
        addMessage({ id: msgId, role: 'assistant', content: text, timestamp: new Date() });
        lastSpokenMsgId.current = msgId;

        setAgentSubtitle(text);
        if (agentSubtitleTimeoutRef.current) clearTimeout(agentSubtitleTimeoutRef.current);
        agentSubtitleTimeoutRef.current = setTimeout(() => setAgentSubtitle(''), 5000);

        // Trigger TTS with talking animation + lip sync ONLY if not already speaking backend audio
        // AND ONLY if we haven't received any server audio for this turn.
        if (!isSpeakingVoiceRef.current && !receivedServerAudioThisTurn.current && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.onstart = () => {
            console.log('[VoiceChatBox] TTS started — playing talking animation');
            // Check again in case audio started while initializing
            if (isSpeakingVoiceRef.current) {
              window.speechSynthesis.cancel();
              return;
            }
            isSpeakingVoiceRef.current = true;
            avatarRef.current?.playTalking();
            lipSyncAnim.current?.start();
          };
          utterance.onend = () => {
            // Only stop if we were the ones speaking (not overridden by audio)
            if (isSpeakingVoiceRef.current && !voiceReady /* check if audio didn't take over */) {
              console.log('[VoiceChatBox] TTS ended');
              isSpeakingVoiceRef.current = false;
              avatarRef.current?.playIdle();
              lipSyncAnim.current?.stop();
            }
          };
          utterance.onerror = () => {
            console.log('[VoiceChatBox] TTS error/cancelled');
            // Don't stop animation if cancelled (might be due to audio override)
            if (!isSpeakingVoiceRef.current) {
              avatarRef.current?.playIdle();
              lipSyncAnim.current?.stop();
            }
          };
          window.speechSynthesis.speak(utterance);
        }
      }
    });

    // Streaming text chunks (for real-time word-by-word display)
    voiceInstance.on('voice_text_chunk', (payload) => {
      const chunk = payload?.delta || payload?.content || payload?.text || '';
      if (chunk) {
        // Delay the text display to match audio playback scheduling
        const context = playbackAudioContextRef.current;
        const scheduledTime = playbackTimeRef.current;
        let delay = 0;
        if (context && scheduledTime > context.currentTime) {
          // Calculate delay in ms, adding a tiny offset for smoother transition
          delay = (scheduledTime - context.currentTime) * 1000;
        }

        setTimeout(() => {
          setAgentSubtitle((prev) => {
            const current = typeof prev === 'string' ? prev : '';
            const next = current + String(chunk);
            return next.length > 120 ? '...' + next.slice(-120) : next;
          });
          if (agentSubtitleTimeoutRef.current) clearTimeout(agentSubtitleTimeoutRef.current);
          agentSubtitleTimeoutRef.current = setTimeout(() => setAgentSubtitle(''), 5000);
        }, delay);
      }
    });

    // Real-time user transcription chunks
    voiceInstance.on('voice_user_chunk', (payload) => {
      const delta = payload?.delta || '';
      if (delta) {
        setUserSubtitle((prev) => {
          const current = typeof prev === 'string' ? prev : '';
          const next = current + String(delta);
          return next.length > 120 ? '...' + next.slice(-120) : next;
        });
        if (userSubtitleTimeoutRef.current) clearTimeout(userSubtitleTimeoutRef.current);
        userSubtitleTimeoutRef.current = setTimeout(() => setUserSubtitle(''), 5000);
      }
    });

    // Voice response: audio playback chunks (backup animation trigger)
    voiceInstance.on('voice_audio_chunk', (payload) => {
      if (payload?.delta) {
        receivedServerAudioThisTurn.current = true; // Mark that we are using server audio
        playPcmChunk(payload.delta, playbackAudioContextRef, playbackTimeRef, agentAnalyserRef);

        // Start real-time lip sync if not already started
        if (agentAnalyserRef.current && !realLipSyncRefs.current.isInitialized) {
          console.log('[VoiceChatBox] Initializing real-time lip sync with agent analyser');
          const { start, stop } = initWithAnalyser(agentAnalyserRef.current);
          realLipSyncRefs.current = { start, stop, isInitialized: true };
        }

        // Start animation if TTS hasn't started it OR if TTS is running (cancel it)
        if (!isSpeakingVoiceRef.current || window.speechSynthesis.speaking) {
          console.log('[VoiceChatBox] Audio chunk -> overriding TTS/starting animation');
          window.speechSynthesis.cancel(); // Stop TTS immediately
          isSpeakingVoiceRef.current = true;
          avatarRef.current?.playTalking();

          // Prefer real lip sync over simulation
          if (realLipSyncRefs.current.isInitialized) {
            realLipSyncRefs.current.start();
          } else {
            lipSyncAnim.current?.start();
          }
        }
      }
    });

    voiceInstance.on('voice_audio_end', () => {
      console.log('[VoiceChatBox] Server audio stream ended');

      // Calculate when the audio will ACTUALLY finish playing
      let delay = 1000; // Default fallback

      const context = playbackAudioContextRef.current;
      const scheduledEndTime = playbackTimeRef.current;

      if (context && scheduledEndTime > 0) {
        const remainingTime = (scheduledEndTime - context.currentTime) * 1000;
        if (remainingTime > 0) {
          delay = remainingTime + 300; // Add 300ms buffer for smooth transition
          console.log(`[VoiceChatBox] Audio still playing for ${Math.round(remainingTime)}ms. Scheduling idle animation in ${Math.round(delay)}ms`);
        }
      }

      setTimeout(() => {
        // Only stop if we are still marked as speaking (and not TTS)
        if (isSpeakingVoiceRef.current) {
          console.log('[VoiceChatBox] Audio playback finished — stopping animation');
          isSpeakingVoiceRef.current = false;
          avatarRef.current?.playIdle();
          lipSyncAnim.current?.stop();
          realLipSyncRefs.current.stop();
        }
      }, delay);
    });

    voiceInstance.on('error', (payload) => {
      console.error('[VoiceChatBox] Voice error:', payload);
      isSpeakingVoiceRef.current = false;
      setIsRecording(false);
      alertError?.(payload?.message || 'Voice error');
    });

    return () => {
      voiceInstance.removeAllListeners();
      voiceInstance.disconnect();
      voiceSocketRef.current = null;
      setVoiceReady(false);
      setIsRecording(false);
      isSpeakingVoiceRef.current = false;
    };
  }, [bookingId, alertError, isWithinStay, addMessage]);

  // --- Recording Functions (same as ClassicChatBox) ---
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

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64; // Small fft for few bars
      userAnalyserRef.current = analyser;

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm = floatTo16BitPCM(inputData);
        const base64 = arrayBufferToBase64(pcm.buffer);
        if (voiceSocketRef.current?.connected) voiceSocketRef.current.emit('voice_client_chunk', { audio: base64 });
      };
      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(audioContext.destination);
      audioContextRef.current = audioContext;
      mediaStreamRef.current = stream;
      processorRef.current = processor;
      voiceSocketRef.current.emit('voice_start');
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
    if (voiceSocketRef.current?.connected) {
      voiceSocketRef.current.emit('voice_stop');
      // Trigger thinking animation as soon as recording stops
      avatarRef.current?.playThinking();
    }
    receivedServerAudioThisTurn.current = false; // Reset turn guard for next response
    setIsRecording(false);
  };

  const handleVoiceToggle = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  // Auto-start voice when user switches from chat to voice (once connection is ready)
  useEffect(() => {
    if (!autoStartVoice || !voiceReady || isRecording) return;
    onVoiceAutoStarted?.();
    startRecording();
  }, [autoStartVoice, voiceReady, isRecording, onVoiceAutoStarted]);

  // Derive initial from guestName
  const guestInitial = guestName ? guestName.charAt(0).toUpperCase() : 'G';

  return (
    <Fade in={true} timeout={800}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 4,
          bgcolor: 'background.paper',
        }}
      >
        {/* Agent Side (Top on Mobile, Left on Desktop) */}
        <Box
          sx={{
            flex: 1,
            bgcolor: 'transparent',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            borderRight: isMobile ? 'none' : '3px solid',
            borderBottom: isMobile ? '3px solid' : 'none',
            borderColor: theme.palette.mode === 'light' ? theme.palette.grey[400] : theme.palette.grey[700],
          }}
        >
          {/* Circular Container for Agent */}
          <Box
            sx={{
              width: isMobile ? 110 : 150,
              height: isMobile ? 110 : 150,
              borderRadius: '50%',
              overflow: 'hidden',
              border: `4px solid ${theme.palette.background.paper}`,
              boxShadow: theme.shadows[4],
              position: 'relative',
              bgcolor: theme.palette.background.paper,
            }}
          >
            <AvatarCanvas
              ref={avatarRef}
              avatarUrl={avatarUrl}
              animationPaths={{
                idle: idleAnimationPath,
                talking: talkingAnimationPath,
                waving: hiAnimationPath,
                thinking: thinkingAnimationPath,
              }}
              onLoad={() => setLoading?.(false)}
              backgroundColor={theme.palette.background.paper}
              isMobile={isMobile}
            />
          </Box>

          {/* Centered Agent Subtitle */}
          {agentSubtitle && (
            <Box
              sx={{
                position: 'absolute',
                top: isMobile ? 40 : 'auto', // Top for agent on mobile
                bottom: isMobile ? 'auto' : 40, // Bottom for agent on desktop
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 150,
                pointerEvents: 'none',
                width: isMobile ? '90%' : '150%', // Allow text to be slightly wider than avatar on desktop
                maxWidth: isMobile ? '90vw' : '400px',
                textAlign: 'center',
              }}
            >
              <WordByWordText
                text={agentSubtitle}
                variant="body2"
                sx={{
                  color: '#000',
                  fontSize: isMobile ? '0.8rem' : '0.85rem',
                  fontWeight: 600,
                  lineHeight: 1.3,
                }}
              />
            </Box>
          )}
          {/* Agent Waveform - Flex */}
          <Box sx={{ mt: 3, width: '100%', display: 'flex', justifyContent: 'center', height: 24 }}>
            <Waveform isActive={isSpeakingVoiceRef.current} color={theme.palette.text.secondary} analyser={agentAnalyserRef.current} />
          </Box>
        </Box>

        {/* User Side (Bottom on Mobile, Right on Desktop) */}
        <Box
          sx={{
            flex: 1,
            bgcolor: 'transparent',
            color: theme.palette.text.primary,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {/* Circular Container for User */}
          <Box
            sx={{
              width: isMobile ? 90 : 120,
              height: isMobile ? 90 : 120,
              borderRadius: '50%',
              border: `4px solid ${theme.palette.primary.main}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'transparent',
              position: 'relative',
            }}
          >
            {/* Simple Initial Avatar */}
            <Typography variant="h2" sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
              {guestInitial}
            </Typography>
          </Box>

          {/* Centered User Subtitle */}
          {userSubtitle && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 40, // Nudged up from 15
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 150,
                pointerEvents: 'none',
                width: isMobile ? '90%' : '150%',
                maxWidth: isMobile ? '90vw' : '400px',
                textAlign: 'center',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: '#000',
                  fontSize: isMobile ? '0.75rem' : '0.8rem',
                  fontWeight: 500,
                }}
              >
                {userSubtitle}
              </Typography>
            </Box>
          )}
          {/* User Waveform - Flex */}
          <Box sx={{ mt: 3, width: '100%', display: 'flex', justifyContent: 'center', height: 24 }}>
            <Waveform isActive={isRecording} color={theme.palette.primary.main} analyser={userAnalyserRef.current} />
          </Box>
        </Box>

        {/* --- Shared Overlays --- */}

        {/* Chat Icon - Top Right (Absolute) */}
        <IconButton
          onClick={() => onSwitchToChat()}
          aria-label="Switch to Chat"
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 100,
            zIndex: 100,
            color: theme.palette.primary.main,
            width: 30,
            height: 30,
            transition: 'transform 0.2s ease-in-out',
            bgcolor: 'rgba(0, 0, 0, 0.2)',
            '&:hover': {
              transform: 'scale(1.2)',
              bgcolor: 'rgba(0, 0, 0, 0.4)',
            },
          }}
        >
          <ChatIcon sx={{ fontSize: 20 }} />
        </IconButton>

        {/* Mic / Waveform Button - Absolute Center */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 100,
          }}
        >
          <IconButton
            size="small"
            onClick={handleVoiceToggle}
            aria-label={isRecording ? 'Stop recording' : voiceReady ? 'Start voice' : 'Connecting…'}
            disabled={!voiceReady}
            sx={{
              color: isRecording ? theme.palette.error.main : theme.palette.background.paper,
              bgcolor: theme.palette.text.primary, // Strong contrast button
              width: 56,
              height: 56,
              boxShadow: theme.shadows[6],
              transition: 'transform 0.2s ease-in-out',
              '&:hover': {
                transform: 'scale(1.1)',
                bgcolor: theme.palette.text.secondary,
              },
            }}
          >
            {voiceReady ? (
              <GraphicEqIcon
                sx={{
                  fontSize: 28,
                  animation: isRecording || isLoading ? `${pulseWave} 0.9s ease-in-out infinite` : 'none',
                }}
              />
            ) : (
              <CircularProgress size={28} sx={{ color: theme.palette.background.paper }} />
            )}
          </IconButton>
        </Box>
        {/* Unified Bottom Subtitles - Removed in favor of split subtitles above */}
      </Box>
    </Fade>
  );
}

// --- Main Wrapper Component ---
const ChatBox = ({ bookingId, alertError, isWithinStay = true, avatarConfig, isMobile, setLoading, isDashboard, guestName }) => {
  const [mode, setMode] = useState('voice'); // 'chat' | 'voice'
  const [autoStartVoice, setAutoStartVoice] = useState(false);
  const containerHeight = isDashboard ? '500px' : '75vh';

  if (!isWithinStay) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: containerHeight, width: '100%', p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <WordByWordText variant="h6" text={`${APP_NAME} will help you with this booking`} />
        </Box>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'action.hover' }}>
          <Typography variant="body2" color="text.secondary">
            {APP_NAME} would be ready to talk to you as soon as you check in!
          </Typography>
        </Box>
      </Box>
    );
  }

  // Mobile: voice increased to 80vh, chat 75vh; desktop: 75vh both.
  const wrapperHeight = isDashboard ? '500px' : isMobile ? (mode === 'voice' ? '80vh' : '75vh') : '75vh';

  return (
    <Box
      sx={{
        height: wrapperHeight,
        width: '100%',
        overflow: 'hidden',
        transition: 'height 0.35s ease-in-out',
      }}
    >
      {mode === 'chat' ? (
        <ClassicChatBox
          bookingId={bookingId}
          alertError={alertError}
          isWithinStay={isWithinStay}
          onSwitchToVoice={() => {
            setMode('voice');
            setAutoStartVoice(true);
          }}
          isMobile={isMobile}
        />
      ) : (
        <VoiceChatBox
          bookingId={bookingId}
          alertError={alertError}
          isWithinStay={isWithinStay}
          onSwitchToChat={() => setMode('chat')}
          avatarConfig={avatarConfig}
          isMobile={isMobile}
          setLoading={setLoading}
          autoStartVoice={autoStartVoice}
          onVoiceAutoStarted={() => setAutoStartVoice(false)}
          guestName={guestName}
        />
      )}
    </Box>
  );
};

// Helpers
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

const playPcmChunk = (base64, audioContextRef, playbackTimeRef, analyserRef) => {
  const bytes = base64ToUint8Array(base64);
  const AudioContextImpl = window.AudioContext || window.webkitAudioContext;
  if (!audioContextRef.current) {
    audioContextRef.current = new AudioContextImpl({ sampleRate: 24000 });
  }
  const audioContext = audioContextRef.current;

  if (analyserRef && !analyserRef.current) {
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    analyserRef.current = analyser;
  }

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
  if (analyserRef && analyserRef.current) {
    source.connect(analyserRef.current);
    analyserRef.current.connect(audioContext.destination);
  } else {
    source.connect(audioContext.destination);
  }

  const now = audioContext.currentTime;
  const startAt = Math.max(playbackTimeRef.current || now, now);
  source.start(startAt);
  playbackTimeRef.current = startAt + audioBuffer.duration;
};

export default ChatBox;
