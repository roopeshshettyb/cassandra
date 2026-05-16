import { useState, useRef, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { floatTo16BitPCM, arrayBufferToBase64, playPcmChunk } from '../../AvatarChatbot/utils/audio';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export interface AgentCard {
  type: 'request' | 'booking' | 'stat' | 'hotel';
  title: string;
  subtitle?: string;
  badge?: string;
  route?: string;
  meta?: Record<string, unknown>;
}

interface UseSocketAllRounderProps {
  onReady?: (messages: any[]) => void;
  onUserMessage?: (text: string) => void;
  onStreamChunk?: (chunk: string) => void;
  onStreamEnd?: (result: { content: string; cards: AgentCard[] }) => void;
  onVoiceTextChunk?: (text: string) => void;
  onVoiceTextEnd?: (result: { text: string; cards: AgentCard[] }) => void;
  onError?: (error: string) => void;
  onChatCreated?: () => void;
  onChatsList?: (chats: any[], activeChatId: number) => void;
  onChatSwitched?: (chatId: number, messages: any[]) => void;
}

export function useSocketAllRounder({
  onReady,
  onUserMessage,
  onStreamChunk,
  onStreamEnd,
  onChatCreated,
  onChatsList,
  onChatSwitched,
  onVoiceTextChunk,
  onVoiceTextEnd,
  onError,
}: UseSocketAllRounderProps) {
  const [isReady, setIsReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onStreamChunkRef = useRef(onStreamChunk);
  onStreamChunkRef.current = onStreamChunk;
  const onStreamEndRef = useRef(onStreamEnd);
  onStreamEndRef.current = onStreamEnd;
  const onVoiceTextChunkRef = useRef(onVoiceTextChunk);
  onVoiceTextChunkRef.current = onVoiceTextChunk;
  const onVoiceTextEndRef = useRef(onVoiceTextEnd);
  onVoiceTextEndRef.current = onVoiceTextEnd;
  const onUserMessageRef = useRef(onUserMessage);
  onUserMessageRef.current = onUserMessage;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onChatCreatedRef = useRef(onChatCreated);
  onChatCreatedRef.current = onChatCreated;
  const onChatsListRef = useRef(onChatsList);
  onChatsListRef.current = onChatsList;
  const onChatSwitchedRef = useRef(onChatSwitched);
  onChatSwitchedRef.current = onChatSwitched;

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playbackAudioContextRef = useRef<AudioContext | null>(null);
  const playbackTimeRef = useRef<number>(0);
  const playbackRafRef = useRef<number | null>(null);
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
    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = io(`${BACKEND_URL}/allrounder`, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      query: { token },
      auth: { token },
    });

    socketRef.current = socket;

    const signalPlaybackDone = () => {
      cancelPlaybackTracking();
      socket.emit('voice_playback_done');
    };

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
      const audioCtx = playbackAudioContextRef.current;
      const remaining = audioCtx ? Math.max(0, (scheduledEndTime - audioCtx.currentTime) * 1000) : 0;
      playbackFallbackTimerRef.current = setTimeout(signalPlaybackDone, remaining + 2000);
    };

    socket.on('disconnect', () => {
      setIsReady(false);
      setIsRecording(false);
      setIsSpeaking(false);
      setIsProcessing(false);
      setIsSending(false);
      cancelPlaybackTracking();
      cleanupAudio();
    });

    socket.on('ready', (payload: any) => {
      setIsReady(true);
      onReadyRef.current?.(payload?.messages || []);
    });

    socket.on('voice_ready', () => {
      setIsReady(true);
      setIsProcessing(false);
      setIsSpeaking(false);
      cancelPlaybackTracking();
      onReadyRef.current?.([]);
    });

    socket.on('voice_turn_end', () => {
      setIsProcessing(true);
      cancelPlaybackTracking();
    });

    socket.on('error', (err: any) => {
      onErrorRef.current?.(err?.message || 'Connection error');
      setIsProcessing(false);
      setIsSpeaking(false);
      setIsSending(false);
    });

    socket.on('stream_chunk', (payload: any) => {
      onStreamChunkRef.current?.(payload?.content || '');
    });

    socket.on('stream_end', (payload: any) => {
      setIsSending(false);
      onStreamEndRef.current?.({ content: payload?.content || '', cards: payload?.cards || [] });
    });

    socket.on('voice_user_message', (payload: any) => {
      onUserMessageRef.current?.(payload?.text || '');
    });

    socket.on('voice_text_chunk', (payload: any) => {
      setIsSpeaking(true);
      onVoiceTextChunkRef.current?.(payload?.delta || '');
    });

    socket.on('voice_text_end', (payload: any) => {
      onVoiceTextEndRef.current?.({ text: payload?.text || '', cards: payload?.cards || [] });
    });

    socket.on('voice_audio_chunk', (payload: any) => {
      if (payload?.delta) {
        playPcmChunk(payload.delta, playbackAudioContextRef, playbackTimeRef);
        setIsSpeaking(true);
      }
    });

    socket.on('voice_audio_end', () => {
      startPlaybackTracking(playbackTimeRef.current);
    });

    socket.on('chat_created', () => {
      onChatCreatedRef.current?.();
    });

    socket.on('chats_list', (payload: any) => {
      onChatsListRef.current?.(payload?.chats || [], payload?.activeChatId);
    });

    socket.on('chat_switched', (payload: any) => {
      onChatSwitchedRef.current?.(payload?.chatId, payload?.messages || []);
    });

    return () => {
      cancelPlaybackTracking();
      cleanupAudio();
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [cleanupAudio, cancelPlaybackTracking]);

  const sendMessage = useCallback((text: string) => {
    if (!socketRef.current?.connected || !text.trim()) return;
    setIsSending(true);
    socketRef.current.emit('message', { content: text });
  }, []);

  const newChat = useCallback(() => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('new_chat');
  }, []);

  const listChats = useCallback(() => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('list_chats');
  }, []);

  const switchChat = useCallback((chatId: number) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('switch_chat', { chatId });
  }, []);

  const sendVoiceText = useCallback((text: string) => {
    if (!socketRef.current?.connected || !text.trim()) return;
    socketRef.current.emit('voice_send_text', { text });
  }, []);

  const startRecording = async () => {
    if (isRecording || !socketRef.current?.connected) return;
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
      onErrorRef.current?.(err?.message || 'Microphone access denied');
    }
  };

  const stopRecording = useCallback(() => {
    cleanupAudio();
    if (socketRef.current?.connected) {
      socketRef.current.emit('voice_stop');
    }
    setIsRecording(false);
  }, [cleanupAudio]);

  return {
    isReady,
    isRecording,
    isSpeaking,
    isProcessing,
    isSending,
    sendMessage,
    sendVoiceText,
    newChat,
    listChats,
    switchChat,
    startRecording,
    stopRecording,
  };
}
