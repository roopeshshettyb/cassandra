import { useRef, useCallback, useEffect } from 'react';

interface UseLipSyncProps {
  onLipSyncUpdate: (value: number) => void;
  smoothing?: number;
}

export function useLipSync({ onLipSyncUpdate, smoothing = 0.3 }: UseLipSyncProps) {
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const currentValueRef = useRef(0);
  const isRunningRef = useRef(false);

  const startAnalyzing = useCallback(() => {
    if (!analyserRef.current || isRunningRef.current) return;

    isRunningRef.current = true;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

    const analyze = () => {
      if (!isRunningRef.current || !analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArray);

      // Focus on speech frequencies (roughly 100Hz - 4000Hz)
      // These correspond to lower frequency bins
      const speechBins = dataArray.slice(0, Math.floor(dataArray.length * 0.3));
      const sum = speechBins.reduce((acc, val) => acc + val, 0);
      const average = sum / speechBins.length / 255;

      // Apply smoothing
      currentValueRef.current = currentValueRef.current * (1 - smoothing) + average * smoothing;

      // Amplify for visible movement
      const lipSyncValue = Math.min(1, currentValueRef.current * 2.5);
      onLipSyncUpdate(lipSyncValue);

      animationFrameRef.current = requestAnimationFrame(analyze);
    };

    analyze();
  }, [onLipSyncUpdate, smoothing]);

  const stopAnalyzing = useCallback(() => {
    isRunningRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    currentValueRef.current = 0;
    onLipSyncUpdate(0);
  }, [onLipSyncUpdate]);

  const initWithSpeechSynthesis = useCallback(() => {
    // Enhanced simulation for more natural, human-like lip movement
    return {
      start: () => {
        isRunningRef.current = true;
        let phase = 0;
        let wordPhase = 0;
        let pauseTimer = 0;
        let isPausing = false;
        
        const simulate = () => {
          if (!isRunningRef.current) return;
          
          // Simulate natural speech patterns with pauses between words
          pauseTimer++;
          if (pauseTimer > 8 && Math.random() > 0.92) {
            isPausing = true;
            pauseTimer = 0;
          }
          if (isPausing && pauseTimer > 4) {
            isPausing = false;
            pauseTimer = 0;
          }
          
          if (isPausing) {
            // Quick close during pauses
            currentValueRef.current = currentValueRef.current * 0.7;
          } else {
            // Simulate mouth movements with varied amplitude
            phase += 0.18 + Math.random() * 0.08;
            wordPhase += 0.07;
            
            // Primary mouth movement
            const base = Math.sin(phase) * 0.5 + 0.5;
            // Secondary variation for realism
            const variation = Math.sin(phase * 2.3) * 0.2 + Math.sin(wordPhase) * 0.15;
            // Random micro-movements
            const micro = (Math.random() - 0.5) * 0.1;
            
            const rawValue = Math.max(0, Math.min(1, base + variation + micro));
            // Smooth transition
            currentValueRef.current = currentValueRef.current * 0.6 + rawValue * 0.4;
          }
          
          onLipSyncUpdate(currentValueRef.current);
          animationFrameRef.current = requestAnimationFrame(simulate);
        };
        
        simulate();
      },
      stop: () => {
        isRunningRef.current = false;
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        // Smoothly close mouth
        const closeAnimation = () => {
          currentValueRef.current *= 0.8;
          if (currentValueRef.current > 0.01) {
            onLipSyncUpdate(currentValueRef.current);
            requestAnimationFrame(closeAnimation);
          } else {
            currentValueRef.current = 0;
            onLipSyncUpdate(0);
          }
        };
        closeAnimation();
      },
    };
  }, [onLipSyncUpdate]);

  const initWithAudioElement = useCallback((audioElement: HTMLAudioElement) => {
    audioElementRef.current = audioElement;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }

    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 256;
    analyserRef.current.smoothingTimeConstant = 0.8;

    sourceRef.current = audioContextRef.current.createMediaElementSource(audioElement);
    sourceRef.current.connect(analyserRef.current);
    analyserRef.current.connect(audioContextRef.current.destination);

    return {
      start: startAnalyzing,
      stop: stopAnalyzing,
    };
  }, [startAnalyzing, stopAnalyzing]);

  const cleanup = useCallback(() => {
    stopAnalyzing();

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    audioElementRef.current = null;
  }, [stopAnalyzing]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    initWithAudioElement,
    initWithSpeechSynthesis,
    startAnalyzing,
    stopAnalyzing,
    cleanup,
  };
}
