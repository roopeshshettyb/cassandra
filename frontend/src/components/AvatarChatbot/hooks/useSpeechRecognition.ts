import { useState, useRef, useCallback, useEffect } from 'react';
import { isSpeechRecognitionSupported } from '../../../helper/utils';

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface UseSpeechRecognitionProps {
  onResult: (transcript: string) => void;
  onInterim?: (transcript: string) => void;
  onError?: (error: string) => void;
  language?: string;
}

export function useSpeechRecognition({
  onResult,
  onInterim,
  onError,
  language = 'en-US',
}: UseSpeechRecognitionProps) {
  const [isListening, setIsListening] = useState(false);
  // Initialize synchronously to avoid timing issues on first tap
  const [isSupported] = useState(() => isSpeechRecognitionSupported());
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isManualStop = useRef(false);

  const startListening = useCallback(() => {
    if (!isSupported) {
      onError?.('Speech recognition is not supported in this browser');
      return;
    }

    // Stop any existing recognition first
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // Ignore
      }
      recognitionRef.current = null;
    }

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onstart = () => {
      setIsListening(true);
      isManualStop.current = false;
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (interimTranscript) {
        onInterim?.(interimTranscript);
      }

      if (finalTranscript) {
        onResult(finalTranscript.trim());
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        onError?.('Microphone access denied. Please allow microphone permission.');
      } else if (event.error !== 'aborted') {
        onError?.(event.error || 'Speech recognition error');
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Auto-restart if not manually stopped
      if (!isManualStop.current && recognitionRef.current) {
        try {
          recognition.start();
        } catch (e) {
          // Recognition might already be started
        }
      }
    };

    recognitionRef.current = recognition;

    // Start recognition directly - browser will handle permission prompt
    try {
      recognition.start();
    } catch (e) {
      console.error('Failed to start recognition:', e);
      onError?.('Failed to start speech recognition');
    }
  }, [isSupported, language, onResult, onInterim, onError]);

  const stopListening = useCallback(() => {
    isManualStop.current = true;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        isManualStop.current = true;
        recognitionRef.current.abort();
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
  };
}
