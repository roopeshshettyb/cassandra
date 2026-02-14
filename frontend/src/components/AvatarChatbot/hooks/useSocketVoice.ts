import { useState, useRef, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { floatTo16BitPCM, arrayBufferToBase64, playPcmChunk } from '../utils/audio';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:7676';

interface UseSocketVoiceProps {
    bookingId: number | string;
    onUserMessage?: (text: string) => void;
    onAssistantTextChunk?: (text: string) => void;
    onAssistantTextEnd?: (text: string) => void;
    onError?: (error: string) => void;
}

export function useSocketVoice({
    bookingId,
    onUserMessage,
    onAssistantTextChunk,
    onAssistantTextEnd,
    onError,
}: UseSocketVoiceProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false); // Rough approximation based on receiving chunks

    const socketRef = useRef<Socket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const playbackAudioContextRef = useRef<AudioContext | null>(null);
    const playbackTimeRef = useRef<number>(0);

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

        socket.on('connect', () => {
            setIsReady(true);
        });

        socket.on('disconnect', () => {
            setIsReady(false);
            setIsRecording(false);
        });

        socket.on('voice_ready', () => {
            setIsReady(true);
        });

        socket.on('error', (err: any) => {
            onError?.(err?.message || 'Voice socket error');
        });

        socket.on('voice_user_message', (payload: any) => {
            onUserMessage?.(payload?.text || '');
        });

        socket.on('voice_text_chunk', (payload: any) => {
            setIsSpeaking(true);
            onAssistantTextChunk?.(payload?.delta || '');
        });

        socket.on('voice_text_end', (payload: any) => {
            setIsSpeaking(false);
            onAssistantTextEnd?.(payload?.text || '');
        });

        socket.on('voice_audio_chunk', (payload: any) => {
            if (payload?.delta) {
                playPcmChunk(payload.delta, playbackAudioContextRef, playbackTimeRef);
                // Re-assert speaking state when audio chunks arrive
                setIsSpeaking(true);
            }
        });

        socket.on('voice_audio_end', () => {
            // Audio playback is fire-and-forget in current utils, 
            // effectively assumes speaking ends when chunks stop? 
            // For UI purposes, we toggle off speaking when text ends usually, 
            // or we could use a timeout if we wanted more precision.
            // setIsSpeaking(false); 
        });

        return () => {
            stopRecording();
            socket.disconnect();
        };
    }, [bookingId]);

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
            const processor = audioContext.createScriptProcessor(4096, 1, 1);

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

        if (socketRef.current?.connected && isRecording) { // Only emit stop if we were recording
            socketRef.current.emit('voice_stop');
        }
        setIsRecording(false);
    }, [isRecording]); // depend on isRecording to know if we should emit stop? Actually refs are stable.

    // fix stopRecording dependency

    return {
        isRecording,
        isReady,
        isSpeaking,
        startRecording,
        stopRecording
    };
}
