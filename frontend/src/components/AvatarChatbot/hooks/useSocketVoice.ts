import { useState, useRef, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { floatTo16BitPCM, arrayBufferToBase64, playPcmChunk } from '../utils/audio';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:7676';

// --- VAD Configuration ---
// Adjust these to fine-tune the auto-stop behavior
const SILENCE_THRESHOLD = 0.015;    // RMS below this = silence (lowered to catch slight background noise)
const SILENCE_DURATION_MS = 1500;   // ms of silence before auto-stop triggers
const MIN_SPOKE_DURATION_MS = 300;  // user must have spoken for at least this long (lowered from 500ms)
const SPEECH_CONFIRM_FRAMES = 2;    // consecutive frames above threshold needed to confirm speech

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
    const [isSpeaking, setIsSpeaking] = useState(false);

    const socketRef = useRef<Socket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const playbackAudioContextRef = useRef<AudioContext | null>(null);
    const playbackTimeRef = useRef<number>(0);

    // VAD refs
    const vadAnalyserRef = useRef<AnalyserNode | null>(null);
    const vadAnimFrameRef = useRef<number | null>(null);
    const silenceStartRef = useRef<number | null>(null);
    const hasSpokeRef = useRef<boolean>(false);
    const isRecordingRef = useRef<boolean>(false);

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
                setIsSpeaking(true);
            }
        });

        socket.on('voice_audio_end', () => {
            // setIsSpeaking(false);
        });

        return () => {
            stopRecording();
            socket.disconnect();
        };
    }, [bookingId]);

    const stopRecording = useCallback(() => {
        // Cancel VAD loop
        if (vadAnimFrameRef.current) {
            cancelAnimationFrame(vadAnimFrameRef.current);
            vadAnimFrameRef.current = null;
        }
        vadAnalyserRef.current = null;
        silenceStartRef.current = null;
        hasSpokeRef.current = false;
        isRecordingRef.current = false;

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

        if (socketRef.current?.connected) {
            console.log('Stopping recording: emitting voice_client_commit and voice_stop');
            socketRef.current.emit('voice_client_commit');
            socketRef.current.emit('voice_stop');
        }
        setIsRecording(false);
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

            // ── VAD: attach AnalyserNode to detect silence ──────────────
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 512;
            source.connect(analyser);
            vadAnalyserRef.current = analyser;

            const vadBuffer = new Float32Array(analyser.fftSize);
            const spokeStartTime = Date.now();
            silenceStartRef.current = null;
            hasSpokeRef.current = false;
            isRecordingRef.current = true;
            let consecutiveSpeechFrames = 0; // hysteresis counter

            const vadLoop = () => {
                if (!isRecordingRef.current || !vadAnalyserRef.current) return;

                vadAnalyserRef.current.getFloatTimeDomainData(vadBuffer);

                // Compute RMS energy of the audio frame
                let sumSq = 0;
                for (let i = 0; i < vadBuffer.length; i++) {
                    sumSq += vadBuffer[i] * vadBuffer[i];
                }
                const rms = Math.sqrt(sumSq / vadBuffer.length);

                const now = Date.now();

                if (rms > SILENCE_THRESHOLD) {
                    // ── Audio above threshold ──
                    consecutiveSpeechFrames++;
                    if (consecutiveSpeechFrames >= SPEECH_CONFIRM_FRAMES) {
                        // Confirmed as real speech (not a noise spike)
                        silenceStartRef.current = null;
                        if (!hasSpokeRef.current && (now - spokeStartTime) > MIN_SPOKE_DURATION_MS) {
                            hasSpokeRef.current = true;
                        }
                    }
                } else {
                    // ── User is silent ──
                    consecutiveSpeechFrames = 0; // reset hysteresis
                    if (silenceStartRef.current === null) {
                        silenceStartRef.current = now;
                    } else if (
                        hasSpokeRef.current &&
                        (now - silenceStartRef.current) >= SILENCE_DURATION_MS
                    ) {
                        // Sustained silence after confirmed speech → auto-commit
                        console.log('VAD: silence detected, auto-stopping to process speech');
                        stopRecording();
                        return; // exit loop
                    }
                }

                vadAnimFrameRef.current = requestAnimationFrame(vadLoop);
            };

            vadAnimFrameRef.current = requestAnimationFrame(vadLoop);
            // ── End VAD ─────────────────────────────────────────────────

            socketRef.current.emit('voice_start');
            console.log('Voice session started (voice_start emitted)');
            setIsRecording(true);
            isRecordingRef.current = true;
        } catch (err: any) {
            onError?.(err?.message || 'Microphone access denied');
            setIsRecording(false);
        }
    };

    return {
        isRecording,
        isReady,
        isSpeaking,
        startRecording,
        stopRecording,
    };
}
