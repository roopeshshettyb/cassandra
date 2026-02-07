import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from 'components/ui/button';
import { Input } from 'components/ui/input';
import { AvatarCanvas, AvatarCanvasRef } from './AvatarCanvas';
import { WaveformVisualizer } from './WaveformVisualizer';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';
import { useSocketChat } from './hooks/useSocketChat';
import { useTypingEffect } from './hooks/useTypingEffect';
import { VoiceStatus } from './types';
import { getBrowserInfo } from './utils/deviceDetection';
import { cn } from 'lib/utils';
import { MessageSquare, Mic, MicOff, AlertCircle, Send, Keyboard } from 'lucide-react';

interface VoiceModeProps {
  avatarUrl: string;
  onSwitchToChat: () => void;
  theme: 'light' | 'dark';
}

export const VoiceMode: React.FC<VoiceModeProps> = ({
  avatarUrl,
  onSwitchToChat,
}) => {
  // ... (keeping refs and state)
  const avatarRef = useRef<AvatarCanvasRef>(null);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [interimText, setInterimText] = useState('');
  const [responseText, setResponseText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [browserInfo] = useState(() => getBrowserInfo());
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState('');

  const { sendMessage, isLoading } = useSocketChat();

  // Typing effect for response text
  const { displayedText } = useTypingEffect({
    text: responseText,
    isActive: status === 'speaking',
    wordsPerSecond: 3.5,
  });

  const handleSpeechEnd = useCallback(() => {
    setStatus('idle');
    setResponseText('');
    // Return to idle animation when speaking ends
    avatarRef.current?.playIdle();
  }, []);

  const { speak, cancel: cancelSpeech, isSpeaking } = useSpeechSynthesis({
    onStart: () => {
      setStatus('speaking');
      // Play talking animation when speaking starts
      avatarRef.current?.playTalking();
    },
    onEnd: handleSpeechEnd,
  });

  const {
    isListening,
    startListening,
    stopListening,
  } = useSpeechRecognition({
    onResult: useCallback(
      async (transcript: string) => {
        setInterimText('');
        setStatus('processing');
        // Play thinking animation while processing
        avatarRef.current?.playThinking();

        const response = await sendMessage(transcript);
        if (response) {
          setResponseText(response);
          speak(response);
        } else {
          setStatus('idle');
          avatarRef.current?.playIdle();
        }
      },
      [sendMessage, speak]
    ),
    onInterim: setInterimText,
    onError: (err) => {
      setError(err);
      setStatus('idle');
    },
  });

  useEffect(() => {
    if (isListening) {
      setStatus('listening');
    }
  }, [isListening]);

  useEffect(() => {
    if (isLoading) {
      setStatus('processing');
    }
  }, [isLoading]);

  const toggleListening = useCallback(() => {
    if (isSpeaking) {
      cancelSpeech();
    }

    if (isListening) {
      stopListening();
      setStatus('idle');
    } else {
      setError(null);
      startListening();
    }
  }, [isListening, isSpeaking, startListening, stopListening, cancelSpeech]);

  const handleTextSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!textInput.trim() || status === 'processing' || status === 'speaking') return;

    const message = textInput.trim();
    setTextInput('');
    setStatus('processing');
    // Play thinking animation while processing
    avatarRef.current?.playThinking();

    if (isSpeaking) {
      cancelSpeech();
    }

    const response = await sendMessage(message);
    if (response) {
      setResponseText(response);
      speak(response);
    } else {
      setStatus('idle');
      avatarRef.current?.playIdle();
    }
  }, [textInput, status, isSpeaking, cancelSpeech, sendMessage, speak]);

  const getStatusText = () => {
    switch (status) {
      case 'listening':
        return interimText || 'Listening...';
      case 'processing':
        return 'Thinking...';
      case 'speaking':
        return 'Speaking...';
      default:
        return 'Tap the mic to start';
    }
  };

  if (!browserInfo.isSupported) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div>
          <h3 className="font-semibold text-lg">Voice Not Supported</h3>
          <p className="text-sm text-muted-foreground mt-1">
            For voice features, please use Chrome or Edge browser.
          </p>
        </div>
        <Button onClick={onSwitchToChat} variant="outline">
          <MessageSquare className="h-4 w-4 mr-2" />
          Use Chat Instead
        </Button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col bg-gradient-to-b from-gray-900 to-gray-950">
      {/* Avatar Container - Full Screen */}
      <div className="absolute inset-0 z-0">
        <AvatarCanvas
          key="voice-avatar"
          ref={avatarRef}
          avatarUrl={avatarUrl}
          className="w-full h-full object-cover"
          onError={(err) => setError(err.message)}
        />
        {/* Subtle overlay gradient at bottom for text readability */}
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
      </div>

      {/* Response Text Overlay (Top Center) - Only when speaking */}
      {status === 'speaking' && responseText && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 w-full max-w-sm z-10 animate-fade-in pointer-events-none">
          <div className="mx-4 bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl px-6 py-4 shadow-2xl text-center ring-1 ring-white/5 min-h-[5rem] flex items-center justify-center">
            <p className="text-xl md:text-2xl font-medium text-white leading-relaxed tracking-wide font-sans drop-shadow-md">
              {(() => {
                const words = displayedText.split(' ');
                const chunkSize = 5;
                // Calculate which chunk to show based on current word count
                // If we have 13 words, we show words 10-14 (indices 10-13)
                const currentChunkIndex = Math.floor((words.length - 1) / chunkSize);
                const start = currentChunkIndex * chunkSize;
                const end = start + chunkSize;
                const visibleWords = words.slice(start, end);

                return visibleWords.join(' ');
              })()}
              <span className="inline-block w-0.5 h-6 bg-blue-400 ml-1 animate-pulse align-middle shadow-[0_0_10px_rgba(96,165,250,0.8)]" />
            </p>
          </div>
        </div>
      )}

      {/* Control Island (Bottom) */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[95%] max-w-xl z-20">
        <div className="bg-black/30 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-2xl transition-all duration-300 ring-1 ring-white/5 hover:bg-black/40">

          {/* Main Visualizer Area */}
          <div className="mb-6 relative h-16 flex items-center justify-center">
            {/* Dynamic Waveform */}
            <div className="w-full h-full opacity-90">
              <WaveformVisualizer
                isActive={status !== 'idle'}
                mode={status === 'listening' ? 'listening' : status === 'speaking' ? 'speaking' : 'idle'}
                className="w-full h-full"
              />
            </div>
          </div>

          {/* Status Text (Floating above controls) */}
          <div className="absolute -top-12 left-0 right-0 flex justify-center pointer-events-none">
            <div className={cn(
              "px-4 py-1.5 rounded-full backdrop-blur-md border border-white/5 shadow-lg transition-all duration-500",
              status === 'listening' ? "bg-blue-500/20 text-blue-200 border-blue-500/30" :
                status === 'speaking' ? "bg-purple-500/20 text-purple-200 border-purple-500/30" :
                  "bg-black/40 text-gray-400"
            )}>
              <p className="text-xs font-semibold tracking-wider uppercase">
                {error ? (
                  <span className="text-red-400 flex items-center gap-2">
                    <AlertCircle className="h-3 w-3" /> {error}
                  </span>
                ) : (
                  getStatusText()
                )}
              </p>
            </div>
          </div>

          {/* Text Input Area (Collapsible) */}
          {showTextInput && (
            <form onSubmit={handleTextSubmit} className="mb-6 animate-in slide-in-from-bottom-2 fade-in duration-300">
              <div className="flex gap-3">
                <Input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type a message to the avatar..."
                  disabled={status === 'processing' || status === 'speaking'}
                  className="bg-white/5 border-white/10 focus-visible:ring-blue-500/50 text-white placeholder:text-gray-500 h-12 text-base rounded-xl px-4"
                  autoFocus
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-12 w-12 shrink-0 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
                  disabled={!textInput.trim()}
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </form>
          )}

          {/* Bottom Controls Row */}
          <div className="flex items-center justify-between px-4">
            {/* Switch Mode Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onSwitchToChat}
              className="h-12 w-12 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Switch to Text Chat"
            >
              <MessageSquare className="h-6 w-6" />
            </Button>

            {/* Mic Toggle (Center Piece) */}
            <div className="relative group">
              {/* Glow effect behind button */}
              <div className={cn(
                "absolute inset-0 rounded-full blur-xl transition-opacity duration-500",
                isListening ? "bg-red-500/40 opacity-100" :
                  status === 'speaking' ? "bg-blue-500/40 opacity-50" :
                    "bg-white/5 opacity-0 group-hover:opacity-20"
              )} />

              <Button
                size="lg"
                onClick={toggleListening}
                disabled={status === 'processing' || showTextInput}
                className={cn(
                  'relative h-20 w-20 rounded-full shadow-2xl border-4 transition-all duration-300 scale-100 group-hover:scale-105 active:scale-95',
                  isListening
                    ? 'bg-red-600 border-red-400 hover:bg-red-500 text-white animate-pulse'
                    : status === 'speaking'
                      ? 'bg-blue-600 border-blue-400 hover:bg-blue-500 text-white'
                      : 'bg-white text-black border-gray-200 hover:bg-gray-100'
                )}
              >
                {isListening ? (
                  <MicOff className="h-8 w-8" />
                ) : (
                  <Mic className="h-8 w-8" />
                )}
              </Button>
            </div>

            {/* Keyboard Toggle */}
            <Button
              variant={showTextInput ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => {
                setShowTextInput(!showTextInput);
                if (isListening) stopListening();
              }}
              className={cn(
                "h-12 w-12 rounded-full transition-all duration-300",
                showTextInput
                  ? "bg-white text-black hover:bg-gray-200 shadow-lg"
                  : "text-gray-400 hover:text-white hover:bg-white/10"
              )}
              title="Type Message"
            >
              <Keyboard className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

