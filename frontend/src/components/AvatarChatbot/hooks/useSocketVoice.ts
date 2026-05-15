import { useState, useRef, useEffect, useCallback, useReducer } from 'react';
import { io, Socket } from 'socket.io-client';
import { floatTo16BitPCM, arrayBufferToBase64, playPcmChunk } from '../utils/audio';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

interface UseSocketVoiceProps {
  bookingId: number | string;
  onReady?: () => void;
  onUserMessage?: (text: string) => void;
  onAssistantTextChunk?: (text: string) => void;
  onAssistantTextEnd?: (text: string) => void;
  onError?: (error: string) => void;
}

export function useSocketVoice({ bookingId, onReady, onUserMessage, onAssistantTextChunk, onAssistantTextEnd, onError }: UseSocketVoiceProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  // True between voice_turn_end and voice_ready (backend is processing LLM+TTS)
  const [isProcessing, setIsProcessing] = useState(false);
  const [retryCount, incRetry] = useReducer((c: number) => c + 1, 0);
  const isReadyRef = useRef(false);

  const socketRef = useRef<Socket | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playbackAudioContextRef = useRef<AudioContext | null>(null);
  const playbackTimeRef = useRef<number>(0);
  // RAF handle — polls audioCtx.currentTime until past playbackTimeRef.current
  const playbackRafRef = useRef<number | null>(null);
  // Fallback timer in case RAF stalls (background tab, suspended context)
  const playbackFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPlaybackTracking = useCallback(() => {
    if (playbackRafRef.current !== null) {
      cancelAnimationFrame(playbackRafRef.current);
      playbackRafRef.current = null;
    }
    if (playbackFallbackTimerRef.current !== null) {
      clearTimeout(playbackFallbackTimerRef.current);
      playbackFallbackTimerRef.current = null;
    }
  }, []);

  const cleanupAudio = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!bookingId) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = io(`${BACKEND_URL}/voice`, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      query: { token, bookingId: String(bookingId) },
      auth: { token },
      reconnection: false,
    });

    socketRef.current = socket;
    isReadyRef.current = false;

    // If voice_ready doesn't arrive within 3s, destroy socket and retry
    const readyTimeout = setTimeout(() => {
      if (!isReadyRef.current) {
        socket.removeAllListeners();
        socket.disconnect();
        incRetry();
      }
    }, 3000);

    // Signal server that client finished playing audio.
    // Called by RAF polling when audioCtx.currentTime passes the scheduled end.
    const signalPlaybackDone = () => {
      cancelPlaybackTracking();
      // Keep isSpeaking=true until voice_ready resets it, so the animation
      // stays alive during the server round-trip and mic restart.
      socket.emit('voice_playback_done');
    };

    // Start RAF polling: fires every ~16ms, checks if audio has finished.
    // Fallback timer kicks in after (duration + 2s) in case RAF stalls.
    const startPlaybackTracking = (scheduledEndTime: number) => {
      cancelPlaybackTracking();

      const poll = () => {
        const audioCtx = playbackAudioContextRef.current;
        if (!audioCtx || audioCtx.currentTime >= scheduledEndTime) {
          signalPlaybackDone();
        } else {
          playbackRafRef.current = requestAnimationFrame(poll);
        }
      };
      playbackRafRef.current = requestAnimationFrame(poll);

      // Fallback: force done if RAF stalls (suspended ctx, background tab)
      const audioCtx = playbackAudioContextRef.current;
      const remaining = audioCtx ? Math.max(0, (scheduledEndTime - audioCtx.currentTime) * 1000) : 0;
      playbackFallbackTimerRef.current = setTimeout(signalPlaybackDone, remaining + 2000);
    };

    socket.on('disconnect', () => {
      setIsReady(false);
      setIsRecording(false);
      setIsSpeaking(false);
      setIsProcessing(false);
      cancelPlaybackTracking();
      cleanupAudio();
    });

    // Backend is ready / ready for the next turn
    socket.on('voice_ready', () => {
      isReadyRef.current = true;
      clearTimeout(readyTimeout);
      setIsReady(true);
      setIsProcessing(false);
      setIsSpeaking(false);
      cancelPlaybackTracking();
      onReadyRef.current?.();
    });

    // Custom pipeline: STT detected end of speech, backend now processing LLM+TTS
    socket.on('voice_turn_end', () => {
      setIsProcessing(true);
      cancelPlaybackTracking();
    });

    // GPT pipeline: session closed
    socket.on('voice_closed', () => {
      setIsReady(false);
      setIsRecording(false);
      setIsSpeaking(false);
      setIsProcessing(false);
      cleanupAudio();
    });

    socket.on('error', (err: any) => {
      onError?.(err?.message || 'Voice socket error');
      setIsProcessing(false);
      setIsSpeaking(false);
    });

    socket.on('voice_user_message', (payload: any) => {
      onUserMessage?.(payload?.text || '');
    });

    socket.on('voice_text_chunk', (payload: any) => {
      setIsSpeaking(true);
      onAssistantTextChunk?.(payload?.delta || '');
    });

    socket.on('voice_text_end', (payload: any) => {
      onAssistantTextEnd?.(payload?.text || '');
    });

    socket.on('voice_audio_chunk', (payload: any) => {
      if (payload?.delta) {
        playPcmChunk(payload.delta, playbackAudioContextRef, playbackTimeRef);
        setIsSpeaking(true);
      }
    });

    // All audio chunks are now scheduled. playbackTimeRef.current = AudioContext time
    // when the last sample will finish. Poll until currentTime passes that point.
    socket.on('voice_audio_end', () => {
      startPlaybackTracking(playbackTimeRef.current);
    });

    return () => {
      clearTimeout(readyTimeout);
      cancelPlaybackTracking();
      cleanupAudio();
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [bookingId, cleanupAudio, cancelPlaybackTracking, retryCount]);

  const startRecording = async () => {
    if (isRecording) return;
    if (!socketRef.current?.connected) {
      onError?.('Voice connection not ready');
      return;
    }
    // Mark recording immediately so animation stays live during getUserMedia setup
    setIsRecording(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const win: any = window;
      const AudioContextImpl = win.AudioContext || win.webkitAudioContext;
      const audioContext = new AudioContextImpl({ sampleRate: 24000 });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(2048, 1, 1);

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm = floatTo16BitPCM(inputData);
        const base64 = arrayBufferToBase64(pcm.buffer);
        if (socketRef.current?.connected) {
          socketRef.current.emit('voice_client_chunk', { audio: base64 });
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      audioContextRef.current = audioContext;
      mediaStreamRef.current = stream;
      processorRef.current = processor;

      socketRef.current.emit('voice_start');
    } catch (err: any) {
      setIsRecording(false);
      onError?.(err?.message || 'Microphone access denied');
    }
  };

  const sendText = useCallback((text: string) => {
    if (!socketRef.current?.connected || !text.trim()) return;
    socketRef.current.emit('voice_send_text', { text });
  }, []);

  // Called when user manually taps to stop
  const stopRecording = useCallback(() => {
    cleanupAudio();
    if (socketRef.current?.connected) {
      socketRef.current.emit('voice_stop');
    }
    setIsRecording(false);
  }, [cleanupAudio]);

  return {
    isRecording,
    isReady,
    isSpeaking,
    isProcessing,
    startRecording,
    stopRecording,
    sendText,
  };
}
