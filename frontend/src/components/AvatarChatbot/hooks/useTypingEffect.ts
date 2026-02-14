import { useState, useEffect, useRef } from 'react';

interface UseTypingEffectProps {
  text: string;
  isActive: boolean;
  wordsPerSecond?: number;
}

export function useTypingEffect({
  text,
  isActive,
  wordsPerSecond = 3,
}: UseTypingEffectProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const wordsRef = useRef<string[]>([]);
  const indexRef = useRef(0);

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!isActive || !text) {
      setDisplayedText('');
      setIsComplete(false);
      indexRef.current = 0;
      return;
    }

    // Split text into words
    wordsRef.current = text.split(' ');
    indexRef.current = 0;
    setDisplayedText('');
    setIsComplete(false);

    const interval = 1000 / wordsPerSecond;

    intervalRef.current = setInterval(() => {
      if (indexRef.current < wordsRef.current.length) {
        indexRef.current += 1;
        setDisplayedText(wordsRef.current.slice(0, indexRef.current).join(' '));
      } else {
        setIsComplete(true);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [text, isActive, wordsPerSecond]);

  return { displayedText, isComplete };
}
