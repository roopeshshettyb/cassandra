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
        let consonantPhase = 0;
        let pauseTimer = 0;
        let isPausing = false;
        let consonantTimer = 0;
        let isConsonant = false;

        const simulate = () => {
          if (!isRunningRef.current) return;

          // Simulate natural speech patterns with pauses between words/phrases
          pauseTimer++;
          // Variable pause frequency (sometimes short, sometimes longer)
          const pauseThreshold = Math.random() > 0.5 ? 12 : 20;
          if (pauseTimer > pauseThreshold && Math.random() > 0.85) {
            isPausing = true;
            pauseTimer = 0;
          }
          if (isPausing && pauseTimer > (Math.random() > 0.5 ? 3 : 6)) {
            isPausing = false;
            pauseTimer = 0;
          }

          // Simulate consonants (quick snaps)
          consonantTimer++;
          if (!isConsonant && consonantTimer > 5 && Math.random() > 0.88) {
            isConsonant = true;
            consonantTimer = 0;
            consonantPhase = 0;
          }
          if (isConsonant && consonantTimer > 2) {
            isConsonant = false;
            consonantTimer = 0;
          }

          if (isPausing) {
            // Quick close during pauses
            currentValueRef.current = currentValueRef.current * 0.65;
          } else if (isConsonant) {
            // Quick snap for consonants (P, T, K, etc.)
            consonantPhase += 1.2;
            const snap = Math.max(0, Math.sin(consonantPhase) * 0.4);
            currentValueRef.current = currentValueRef.current * 0.5 + snap * 0.5;
          } else {
            // Simulate mouth movements with varied amplitude for vowels
            phase += 0.15 + Math.random() * 0.12; // Variable speed
            wordPhase += 0.06;

            // Primary mouth movement (vowel sounds - more sustained)
            const base = Math.sin(phase) * 0.45 + 0.55; // Bias toward open

            // Secondary variation for realism (jaw movement)
            const jawMovement = Math.sin(phase * 1.8) * 0.18;

            // Tertiary layer (tongue/lip micro-movements)
            const lipMovement = Math.sin(phase * 3.2) * 0.08 + Math.sin(wordPhase * 1.5) * 0.12;

            // Random micro-movements
            const micro = (Math.random() - 0.5) * 0.08;

            // Occasional emphasis (louder syllables)
            const emphasis = Math.random() > 0.92 ? 0.15 : 0;

            const rawValue = Math.max(0, Math.min(1, base + jawMovement + lipMovement + micro + emphasis));

            // Smooth transition with adaptive smoothing
            const smoothFactor = isConsonant ? 0.3 : 0.55; // Faster response for consonants
            currentValueRef.current = currentValueRef.current * smoothFactor + rawValue * (1 - smoothFactor);
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
