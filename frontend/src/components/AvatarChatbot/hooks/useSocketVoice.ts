import { useState, useRef, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { floatTo16BitPCM, arrayBufferToBase64, playPcmChunk } from '../utils/audio';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:7676';

interface UseSocketVoiceProps {
    bookingId: number | string;
    onUserMessage?: (text: string) => void;
    onAssistantTextEnd?: (text: string) => void;
    onError?: (error: string) => void;
}

export function useSocketVoice({
    bookingId,
    onUserMessage,
    onAssistantTextEnd,
    onError,
}: UseSocketVoiceProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [speakingText, setSpeakingText] = useState('');

    const socketRef = useRef<Socket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const playbackAudioContextRef = useRef<AudioContext | null>(null);
    const playbackTimeRef = useRef<number>(0);
    // Accumulates LLM text before audio arrives, then shown as subtitle once audio starts
    const pendingTextRef = useRef('');
    const isSpeakingRef = useRef(false);

    useEffect(() => {
        if (!bookingId) return;
        const token = localStorage.getItem('token');
        if (!token) return;

        const socket = io(`${BACKEND_URL}/voice`, {
            path: '/socket.io',
            transports: ['websocket', 'polling'],
            query: { token, bookingId: String(bookingId) },
            auth: { token },
        });

        socketRef.current = socket;

        socket.on('connect', () => setIsReady(true));
        socket.on('disconnect', () => {
            setIsReady(false);
            setIsRecording(false);
        });
        socket.on('voice_ready', () => setIsReady(true));
        socket.on('error', (err: any) => onError?.(err?.message || 'Voice socket error'));

        socket.on('voice_user_message', (payload: any) => {
            // New turn starting — reset any leftover speaking state from previous turn
            isSpeakingRef.current = false;
            pendingTextRef.current = '';
            setIsSpeaking(false);
            setSpeakingText('');
            onUserMessage?.(payload?.text || '');
        });

        // Accumulate text silently — subtitle only appears when audio starts
        socket.on('voice_text_chunk', (payload: any) => {
            pendingTextRef.current += (payload?.delta || '');
        });

        socket.on('voice_text_end', (payload: any) => {
            const fullText = payload?.text || pendingTextRef.current;
            pendingTextRef.current = fullText;
            onAssistantTextEnd?.(fullText);
        });

        socket.on('voice_audio_chunk', (payload: any) => {
            if (!payload?.delta) return;
            playPcmChunk(payload.delta, playbackAudioContextRef, playbackTimeRef);
            if (!isSpeakingRef.current) {
                // First audio chunk — show the text we buffered so far as subtitle
                isSpeakingRef.current = true;
                setIsSpeaking(true);
                setSpeakingText(pendingTextRef.current);
            }
        });

        socket.on('voice_audio_end', () => {
            pendingTextRef.current = '';
            const ctx = playbackAudioContextRef.current;
            if (ctx && playbackTimeRef.current > ctx.currentTime) {
                const remainingMs = (playbackTimeRef.current - ctx.currentTime) * 1000;
                setTimeout(() => {
                    isSpeakingRef.current = false;
                    setIsSpeaking(false);
                    setSpeakingText('');
                }, remainingMs);
            } else {
                isSpeakingRef.current = false;
                setIsSpeaking(false);
                setSpeakingText('');
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [bookingId]);

    const stopAudio = useCallback(() => {
        if (playbackAudioContextRef.current) {
            playbackAudioContextRef.current.close().catch(() => {});
            playbackAudioContextRef.current = null;
            playbackTimeRef.current = 0;
        }
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        setSpeakingText('');
        pendingTextRef.current = '';
    }, []);

    const startRecording = async () => {
        if (isRecording) return;
        if (!socketRef.current?.connected) {
            onError?.('Voice connection not ready');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const AudioContextImpl = window.AudioContext || (window as any).webkitAudioContext;
            const audioContext = new AudioContextImpl({ sampleRate: 24000 });
            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(2048, 1, 1);

            processor.onaudioprocess = (e) => {
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
            setIsRecording(true);
        } catch (err: any) {
            onError?.(err?.message || 'Microphone access denied');
            setIsRecording(false);
        }
    };

    const stopRecording = useCallback(() => {
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
            mediaStreamRef.current.getTracks().forEach(t => t.stop());
            mediaStreamRef.current = null;
        }

        // Kill any audio currently playing or scheduled
        stopAudio();

        if (socketRef.current?.connected && isRecording) {
            socketRef.current.emit('voice_stop');
        }
        setIsRecording(false);
    }, [isRecording, stopAudio]);

    return {
        isRecording,
        isReady,
        isSpeaking,
        speakingText,
        startRecording,
        stopRecording,
    };
}
