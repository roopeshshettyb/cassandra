import { useState, useEffect, useRef, useCallback } from 'react';

export function useAudioAnalyzer(isActive: boolean) {
    const [volume, setVolume] = useState(0);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyzerRef = useRef<AnalyserNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animationRef = useRef<number | null>(null);

    const stopAnalyzer = useCallback(() => {
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        setVolume(0);
    }, []);

    const startAnalyzer = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const audioContext = new AudioContextClass();
            audioContextRef.current = audioContext;

            const analyzer = audioContext.createAnalyser();
            analyzer.fftSize = 256;
            analyzerRef.current = analyzer;

            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyzer);

            const dataArray = new Uint8Array(analyzer.frequencyBinCount);

            const updateVolume = () => {
                if (!analyzerRef.current) return;

                analyzerRef.current.getByteFrequencyData(dataArray);

                // Calculate average volume
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const average = sum / dataArray.length;

                // Normalize to 0-1 range
                setVolume(average / 128);

                animationRef.current = requestAnimationFrame(updateVolume);
            };

            updateVolume();
        } catch (err) {
            console.error('Error accessing microphone for audio analyzer:', err);
        }
    }, []);

    useEffect(() => {
        if (isActive) {
            startAnalyzer();
        } else {
            stopAnalyzer();
        }

        return () => {
            stopAnalyzer();
        };
    }, [isActive, startAnalyzer, stopAnalyzer]);

    return volume;
}
