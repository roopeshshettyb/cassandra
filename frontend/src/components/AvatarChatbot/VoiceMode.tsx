import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { AvatarCanvas, AvatarCanvasRef } from './AvatarCanvas';
import { WaveformVisualizer } from './WaveformVisualizer';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';
import { useSocketChat } from './hooks/useSocketChat';
import { useTypingEffect } from './hooks/useTypingEffect';
import { useLipSync } from './hooks/useLipSync';
import { VoiceStatus } from './types';
import { getBrowserInfo } from './utils/deviceDetection';
import { cn } from '../../lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { MessageSquare, Mic, MicOff, AlertCircle, Send, Keyboard, UserCircle } from 'lucide-react';

interface VoiceModeProps {
  avatarUrl: string;
  onSwitchToChat: () => void;
  theme: 'light' | 'dark';
  avatarOptions: { id: string; name: string; url: string; }[];
  onAvatarChange: (url: string) => void;
}

export const VoiceMode: React.FC<VoiceModeProps> = ({
  avatarUrl,
  onSwitchToChat,
  avatarOptions,
  onAvatarChange,
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

  // Lip Sync
  const { initWithSpeechSynthesis } = useLipSync({
    onLipSyncUpdate: useCallback((value: number) => {
      avatarRef.current?.setLipSync(value);
    }, []),
    smoothing: 0.5,
  });

  const lipSyncAnim = useRef<ReturnType<typeof initWithSpeechSynthesis>>(null);

  useEffect(() => {
    lipSyncAnim.current = initWithSpeechSynthesis();
    return () => {
      lipSyncAnim.current?.stop();
    };
  }, [initWithSpeechSynthesis]);

  const handleSpeechEnd = useCallback(() => {
    setStatus('idle');
    setResponseText('');
    // Stop lip sync and return to idle animation
    lipSyncAnim.current?.stop();
    avatarRef.current?.playIdle();
  }, []);

  const { speak, cancel: cancelSpeech, isSpeaking } = useSpeechSynthesis({
    onStart: () => {
      setStatus('speaking');
      // Play talking animation and start lip sync when speaking starts
      avatarRef.current?.playTalking();
      lipSyncAnim.current?.start();
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
      {/* Avatar Selection Menu (Top Right) */}
      <div className="absolute top-4 right-4 z-30">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all shadow-lg"
              title="Switch Avatar"
            >
              <UserCircle className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-gray-900/90 backdrop-blur-xl border-white/10 text-white">
            <DropdownMenuLabel>Switch Persona</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/10" />
            {avatarOptions.map((option) => (
              <DropdownMenuItem
                key={option.id}
                onClick={() => onAvatarChange(option.url)}
                className={cn(
                  "flex items-center gap-2 cursor-pointer focus:bg-white/10 focus:text-white transition-colors",
                  avatarUrl === option.url && "bg-blue-600/20 text-blue-400 font-medium"
                )}
              >
                <div className={cn(
                  "h-2 w-2 rounded-full",
                  avatarUrl === option.url ? "bg-blue-400" : "bg-transparent"
                )} />
                {option.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* Avatar Container - Full Screen */}
      <div className="absolute inset-0 z-0">
        <AvatarCanvas
          key={`voice-avatar-${avatarUrl}`}
          ref={avatarRef}
          avatarUrl={avatarUrl}
          className="w-full h-full object-cover"
          onError={(err) => setError(err.message)}
        />
        {/* Subtle overlay gradient at bottom for text readability */}
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
      </div>

      {/* Control Island (Bottom) */}
      <div className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 w-[96%] sm:w-[95%] max-w-xl z-20">
        <div className="bg-black/30 backdrop-blur-2xl border border-white/10 rounded-3xl sm:rounded-[2rem] px-3 py-4 sm:p-6 shadow-2xl transition-all duration-300 ring-1 ring-white/5">

          {/* Subtitle/Caption - Bottom Middle Above Input */}
          {status === 'speaking' && responseText && (
            <div className="mb-3 sm:mb-4 px-2 sm:px-4 animate-fade-in">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-2 sm:px-4 sm:py-3 text-center min-h-[2.5rem] sm:min-h-[3rem] flex items-center justify-center">
                <p className="text-xs sm:text-sm md:text-base font-medium text-white/90 leading-relaxed">
                  {(() => {
                    const words = displayedText.split(' ');
                    const chunkSize = 5;
                    const currentChunkIndex = Math.floor((words.length - 1) / chunkSize);
                    const start = currentChunkIndex * chunkSize;
                    const end = start + chunkSize;
                    const visibleWords = words.slice(start, end);
                    return visibleWords.join(' ');
                  })()}
                  <span className="inline-block w-0.5 h-3 sm:h-4 bg-blue-400 ml-1 animate-pulse align-middle" />
                </p>
              </div>
            </div>
          )}

          {/* Status Text (Floating above controls) */}
          <div className="absolute -top-10 sm:-top-12 left-0 right-0 flex justify-center pointer-events-none">
            <div className={cn(
              "px-3 py-1 sm:px-4 sm:py-1.5 rounded-full backdrop-blur-md border border-white/5 shadow-lg transition-all duration-500 text-xs sm:text-sm",
              status === 'listening' ? "bg-blue-500/20 text-blue-200 border-blue-500/30" :
                status === 'speaking' ? "bg-purple-500/20 text-purple-200 border-purple-500/30" :
                  "bg-black/40 text-gray-400"
            )}>
              <p className="font-semibold tracking-wider uppercase">
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
            <form onSubmit={handleTextSubmit} className="mb-4 sm:mb-6 animate-in slide-in-from-bottom-2 fade-in duration-300">
              <div className="flex gap-2 sm:gap-3">
                <Input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type a message..."
                  disabled={status === 'processing' || status === 'speaking'}
                  className="bg-white/5 border-white/10 focus-visible:ring-blue-500/50 text-white placeholder:text-gray-500 h-10 sm:h-12 text-sm sm:text-base rounded-xl px-3 sm:px-4"
                  autoFocus
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
                  disabled={!textInput.trim()}
                >
                  <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </div>
            </form>
          )}

          {/* Bottom Controls Row */}
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Left: Small Waveform Visualizer */}
            <div className="flex-shrink-0 w-16 h-12 sm:w-20 sm:h-14 bg-white/5 rounded-xl border border-white/10 overflow-hidden">
              <WaveformVisualizer
                isActive={status !== 'idle'}
                mode={status === 'listening' ? 'listening' : status === 'speaking' ? 'speaking' : 'idle'}
                className="w-full h-full opacity-80"
              />
            </div>

            {/* Center: Mic Toggle (Main Control) */}
            <div className="relative group flex-shrink-0">
              {/* Glow effect */}
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
                  'relative h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 rounded-full shadow-2xl border-4 transition-all duration-300 scale-100 group-hover:scale-105 active:scale-95',
                  isListening
                    ? 'bg-red-600 border-red-400 hover:bg-red-500 text-white animate-pulse'
                    : status === 'speaking'
                      ? 'bg-blue-600 border-blue-400 hover:bg-blue-500 text-white'
                      : 'bg-white text-black border-gray-200 hover:bg-gray-100'
                )}
              >
                {isListening ? (
                  <MicOff className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />
                ) : (
                  <Mic className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />
                )}
              </Button>
            </div>

            {/* Right: Action Buttons */}
            <div className="flex gap-1 sm:gap-2 flex-shrink-0">
              {/* Keyboard Toggle */}
              <Button
                variant={showTextInput ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => {
                  setShowTextInput(!showTextInput);
                  if (isListening) stopListening();
                }}
                className={cn(
                  "h-10 w-10 sm:h-12 sm:w-12 rounded-full transition-all duration-300",
                  showTextInput
                    ? "bg-white text-black hover:bg-gray-200 shadow-lg"
                    : "text-gray-400 hover:text-white hover:bg-white/10"
                )}
                title={showTextInput ? 'Hide Keyboard' : 'Show Keyboard'}
              >
                <Keyboard className="h-5 w-5 sm:h-6 sm:w-6" />
              </Button>

              {/* Switch Mode Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={onSwitchToChat}
                className="h-10 w-10 sm:h-12 sm:w-12 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Switch to Text Chat"
              >
                <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

