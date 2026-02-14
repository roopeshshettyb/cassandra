import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Box, Button, CircularProgress, IconButton, TextField, Typography, Paper, Tooltip, Fade } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import ThreeDRotationIcon from '@mui/icons-material/ThreeDRotation';
import MicIcon from '@mui/icons-material/Mic';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import ChatIcon from '@mui/icons-material/Chat';
import { io } from 'socket.io-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { keyframes } from '@mui/system';
import constants from '../constants.json';

// Imports for Voice Mode (3D Avatar)
import { AvatarCanvas } from './AvatarChatbot/AvatarCanvas';
import { ChatMode } from './AvatarChatbot/ChatMode';
import { useSocketChat } from './AvatarChatbot/hooks/useSocketChat';
import { useLipSync } from './AvatarChatbot/hooks/useLipSync';

const { APP_NAME } = constants;
const DEFAULT_AVATAR_URL = 'https://models.readyplayer.me/698df165d9645a11b117e2fc.glb';

const getBackendUrl = () => (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');

const pulseWave = keyframes({
  '0%': { transform: 'scaleY(1)', opacity: 0.7 },
  '50%': { transform: 'scaleY(1.3)', opacity: 1 },
  '100%': { transform: 'scaleY(1)', opacity: 0.7 },
});

// --- Classic Chat Component (The Original UI) ---
function ClassicChatBox({ bookingId, alertError, isWithinStay, onSwitchToVoice }) {
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

  useEffect(() => {
    if (!bookingId || isNaN(bookingId) || !isWithinStay) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    const connectUrl = getBackendUrl();
    if (!connectUrl) return;

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

    voiceInstance.on('connect', () => setVoiceReady(false));
    voiceInstance.on('disconnect', () => {
      setVoiceReady(false);
      setIsRecording(false);
    });
    voiceInstance.on('auth_required', () => voiceInstance.emit('auth', { token, bookingId }));
    voiceInstance.on('ready', () => setVoiceReady(true));
    voiceInstance.on('voice_ready', () => setVoiceReady(true));
    voiceInstance.on('voice_text_chunk', (payload) => setStreamingContent((prev) => prev + (payload.delta || '')));
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
      setMessages((prev) => [...prev, { id: `user-voice-${Date.now()}`, role: 'user', content: text, createdAt: new Date().toISOString() }]);
    });
    voiceInstance.on('voice_audio_chunk', (payload) => {
      if (payload?.delta) playPcmChunk(payload.delta, playbackAudioContextRef, playbackTimeRef);
    });
    voiceInstance.on('error', (payload) => {
      setStreamingContent('');
      setSending(false);
      alertError?.(payload?.message || 'Something went wrong with voice');
      focusInput();
    });
    voiceInstance.on('connect_error', (err) => alertError?.(err?.message || 'Voice connection failed'));

    return () => {
      voiceInstance.removeAllListeners();
      voiceInstance.disconnect();
      voiceSocketRef.current = null;
      setVoiceReady(false);
      setIsRecording(false);
    };
  }, [bookingId, alertError, focusInput, isWithinStay]);

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
        if (voiceSocketRef.current?.connected) voiceSocketRef.current.emit('voice_client_chunk', { audio: base64 });
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
      stopRecording();
      voiceSocketRef.current.emit('voice_stop');
      return;
    }
    voiceSocketRef.current.emit('voice_start');
    await startRecording();
  };

  if (!bookingId || isNaN(bookingId)) return null;
  if (!isWithinStay) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '60vh', width: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="h6">{APP_NAME} will help you with this booking</Typography>
        </Box>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'action.hover' }}>
          <Typography variant="body2" color="text.secondary">{APP_NAME} would be ready to talk to you as soon as you check in!</Typography>
        </Box>
      </Box>
    );
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
      <Box sx={{
        '& p': { m: 0 }, '& ul, & ol': { m: 0, pl: 2.5 }, '& li': { mt: 0.5 }, '& a': { color: 'inherit' },
        '& code': { fontFamily: 'monospace' }, '& pre': { m: 0, p: 1, overflow: 'auto', borderRadius: 1, bgcolor: isUser ? 'rgba(255, 0, 0, 0.18)' : 'action.hover' },
        '& :not(pre) > code': { px: 0.6, py: 0.2, borderRadius: 0.8, bgcolor: isUser ? 'rgba(255,255,255,0.16)' : 'action.hover' },
      }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || ''}</ReactMarkdown>
      </Box>
    );
  };

  const chatInner = (
    <>
      <Box ref={scrollContainerRef} onScroll={handleScroll} sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {messages.map((m) => (
          <Box key={m.id} sx={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', px: 2, py: 1, borderRadius: 2, bgcolor: m.role === 'user' ? 'primary.main' : 'action.hover', color: m.role === 'user' ? 'primary.contrastText' : 'text.primary' }}>
            {renderMarkdown(m.content, m.role)}
          </Box>
        ))}
        {streamingContent && (
          <Box sx={{ alignSelf: 'flex-start', maxWidth: '85%', px: 2, py: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
            {renderMarkdown(streamingContent)}
          </Box>
        )}
        {!streamingContent && sending && (
          <Box sx={{ alignSelf: 'flex-start', maxWidth: '85%', px: 2, py: 1.5, borderRadius: 2, bgcolor: 'action.hover', display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">{APP_NAME} is thinking…</Typography>
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
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          disabled={!ready || sending}
          multiline
          maxRows={4}
        />
        <IconButton color={isRecording ? 'secondary' : 'primary'} onClick={handleVoice} disabled={!ready || !voiceReady} aria-label="Voice" sx={{ transition: 'transform 0.2s ease, opacity 0.2s ease', transform: isRecording ? 'scale(1.15)' : 'scale(1)', opacity: !ready || !voiceReady ? 0.4 : 1 }}>
          <GraphicEqIcon sx={{ animation: isRecording ? `${pulseWave} 0.9s ease-in-out infinite` : 'none' }} />
        </IconButton>
        <Button variant="contained" onClick={handleSend} disabled={!ready || sending || !input.trim()} endIcon={<SendIcon />}>Send</Button>
      </Box>
    </>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '60vh', width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6">{APP_NAME} will help you with this booking</Typography>
          {(sending || streamingContent) && <CircularProgress size={16} />}
          {connectionNote ? <Typography variant="caption" color="text.secondary">{connectionNote}</Typography> : !ready && <Typography variant="caption" color="text.secondary">Connecting…</Typography>}
        </Box>

        {/* Switch Mode Button (Restored) */}
        <Tooltip title="Switch to 3D Avatar">
          <IconButton onClick={() => onSwitchToVoice && onSwitchToVoice()} size="small" sx={{ bgcolor: 'action.selected', color: 'primary.main' }}>
            <ThreeDRotationIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: 1, borderColor: 'divider', borderRadius: 2 }}>{chatInner}</Box>
    </Box>
  );
}

// --- Voice Chat Component (The New 3D UI) ---
function VoiceChatBox({ bookingId, alertError, isWithinStay, onSwitchToChat }) {
  const [avatarConfig, setAvatarConfig] = useState(null);
  const avatarRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceReady, setVoiceReady] = useState(false);

  // Voice socket refs (same pattern as ClassicChatBox)
  const voiceSocketRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const processorRef = useRef(null);
  const playbackAudioContextRef = useRef(null);
  const playbackTimeRef = useRef(0);

  // Lip Sync Simulation
  const { initWithSpeechSynthesis } = useLipSync({
    onLipSyncUpdate: useCallback((value) => {
      if (avatarRef.current) {
        avatarRef.current.setLipSync(value);
      }
    }, []),
    smoothing: 0.5,
  });

  const lipSyncAnim = useRef(null);
  useEffect(() => {
    lipSyncAnim.current = initWithSpeechSynthesis();
    return () => { if (lipSyncAnim.current) lipSyncAnim.current.stop(); };
  }, [initWithSpeechSynthesis]);

  // Chat socket for shared message history (text mode uses this)
  const { messages, isLoading, error, sendMessage, addMessage } = useSocketChat(bookingId);
  const prevIsLoading = useRef(isLoading);

  // Track if currently playing voice audio
  const isSpeakingVoiceRef = useRef(false);
  // Track last spoken message ID to prevent repeating TTS
  const lastSpokenMsgId = useRef('');

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

  // Handle TTS for text-chat messages ONLY (when user types in classic mode and switches)
  useEffect(() => {
    if (isSpeakingVoiceRef.current) return;
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
      }
    });

    // Voice response: text complete — use this to trigger TTS + talking animation if audio isn't already playing
    voiceInstance.on('voice_text_end', (payload) => {
      const text = payload?.text || '';
      console.log('[VoiceChatBox] Voice text end:', text.substring(0, 50) + '...');
      if (text) {
        // Add assistant response to shared message history
        const msgId = `assistant-voice-${Date.now()}`;
        addMessage({ id: msgId, role: 'assistant', content: text, timestamp: new Date() });
        lastSpokenMsgId.current = msgId; // Prevent the messages effect from also speaking it

        // Trigger TTS with talking animation + lip sync ONLY if not already speaking backend audio
        if (!isSpeakingVoiceRef.current && 'speechSynthesis' in window) {
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
              // Actually simpler: just stop. If audio takes over, it will restart animation.
              // But we need to be careful not to stop audio animation.
              // If isSpeakingVoiceRef is true, it might be audio.
              // Let's rely on voice_audio_end for cleanup if audio is involved.
              // If this was purely TTS, we stop.
              // We can't easily distinguish "TTS finished" vs "Audio still playing" with just one ref.
              // But audio handler cancels TTS. So if we are here, TTS finished naturally.
              // So safe to stop? No, audio might have started *during* TTS and cancelled it?
              // If audio cancelled it, onend might fire? Yes.
              // If audio is playing, we want animation to continue.
              // Let's check window.speechSynthesis.speaking (it should be false now).
              // Real audio doesn't set speechSynthes...
              // The issue: if we stop animation here, we might stop the audio animation.
              // Better: if isSpeakingVoiceRef is true, assume audio might be playing?
              // No, we set isSpeakingVoiceRef=true for TTS too.
              // Let's use a separate flag for "isPlayingBackendAudio"?
              // Or just:
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

    // Streaming text chunks (for future subtitle display)
    voiceInstance.on('voice_text_chunk', (payload) => {
      // Could show real-time subtitle here
    });

    // Voice response: audio playback chunks (backup animation trigger)
    voiceInstance.on('voice_audio_chunk', (payload) => {
      if (payload?.delta) {
        playPcmChunk(payload.delta, playbackAudioContextRef, playbackTimeRef);

        // Start animation if TTS hasn't started it OR if TTS is running (cancel it)
        if (!isSpeakingVoiceRef.current || window.speechSynthesis.speaking) {
          console.log('[VoiceChatBox] Audio chunk -> overriding TTS/starting animation');
          window.speechSynthesis.cancel(); // Stop TTS immediately
          isSpeakingVoiceRef.current = true;
          avatarRef.current?.playTalking();
          lipSyncAnim.current?.start();
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
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm = floatTo16BitPCM(inputData);
        const base64 = arrayBufferToBase64(pcm.buffer);
        if (voiceSocketRef.current?.connected) voiceSocketRef.current.emit('voice_client_chunk', { audio: base64 });
      };
      source.connect(processor);
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
    }
    setIsRecording(false);
  };

  const handleVoiceToggle = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  const activeAvatarUrl = avatarConfig?.modelUrl || DEFAULT_AVATAR_URL;

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000'}/avatar-config/${bookingId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setAvatarConfig(data);
        }
      } catch (err) {
        console.error('Failed to fetch avatar config:', err);
      }
    };
    if (bookingId) fetchConfig();
  }, [bookingId]);

  return (
    <Fade in={true} timeout={800}>
      <Box sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        width: '100%', height: '60vh', position: 'relative', overflow: 'hidden',
        bgcolor: '#F3F4F6', borderRadius: 4,
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)' // Soft shadow for light mode
      }}>
        {/* Avatar Canvas */}
        <Box sx={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <AvatarCanvas
            ref={avatarRef}
            avatarUrl={avatarConfig?.avatarUrl || DEFAULT_AVATAR_URL}
            animationPaths={{
              idle: avatarConfig?.idleAnimationPath || '/animations/idle.fbx',
              talking: avatarConfig?.talkingAnimationPath || '/animations/talking.fbx',
              waving: avatarConfig?.hiAnimationPath || '/animations/waving.fbx',
              thinking: avatarConfig?.thinkingAnimationPath || '/animations/thinking.fbx',
            }}
            backgroundColor={'#F3F4F6'}
          />
          {/* Gradient overlay - Light fade at bottom to blend with controls */}
          <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(to top, #F3F4F6 10%, rgba(243, 244, 246, 0), transparent)', pointerEvents: 'none' }} />
        </Box>

        {/* Chat Icon - Top Right */}
        <IconButton
          onClick={() => onSwitchToChat()}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 100,
            bgcolor: 'background.paper',
            color: 'primary.main',
            width: 44,
            height: 44,
            border: '1px solid',
            borderColor: 'primary.light',
            '&:hover': { bgcolor: 'action.hover', transform: 'scale(1.05)' },
            transition: 'all 0.2s ease',
            boxShadow: 2
          }}
        >
          <ChatIcon sx={{ fontSize: 22 }} />
        </IconButton>

        {/* Mic / Waveform Button - Bottom Center */}
        <Box sx={{
          position: 'absolute',
          bottom: 32,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
        }}>
          <Box
            onClick={handleVoiceToggle}
            sx={{
              px: 4,
              height: 64,
              bgcolor: isRecording ? 'error.light' : 'background.paper', // Use theme error/background
              borderRadius: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(16px)',
              border: '1px solid',
              borderColor: isRecording ? 'error.main' : 'divider',
              boxShadow: isRecording ? 4 : 2, // Use theme shadows
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              '&:hover': {
                bgcolor: isRecording ? 'error.light' : 'action.hover',
                transform: 'scale(1.05)',
                borderColor: isRecording ? 'error.dark' : 'primary.main'
              }
            }}
          >
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 44, height: 44, borderRadius: '50%',
              bgcolor: isRecording ? 'error.main' : (isLoading ? 'primary.light' : 'primary.main'),
              color: isRecording ? 'error.contrastText' : 'primary.contrastText',
              transition: 'all 0.3s ease',
            }}>
              <GraphicEqIcon sx={{
                fontSize: 24,
                animation: (isRecording || isLoading) ? `${pulseWave} 0.9s ease-in-out infinite` : 'none'
              }} />
            </Box>
          </Box>
        </Box>
      </Box>
    </Fade>
  );
}

// --- Main Wrapper Component ---
const ChatBox = ({ bookingId, alertError, isWithinStay = true }) => {
  const [mode, setMode] = useState('voice'); // 'chat' | 'voice'

  if (mode === 'chat') {
    return (
      <ClassicChatBox
        bookingId={bookingId}
        alertError={alertError}
        isWithinStay={isWithinStay}
        onSwitchToVoice={() => setMode('voice')}
      />
    );
  }

  return (
    <VoiceChatBox
      bookingId={bookingId}
      alertError={alertError}
      isWithinStay={isWithinStay}
      onSwitchToChat={() => setMode('chat')}
    />
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
