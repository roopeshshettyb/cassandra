import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { WaveformVisualizer } from './WaveformVisualizer';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';
import { useLipSync } from './hooks/useLipSync';
import { useAudioAnalyzer } from './hooks/useAudioAnalyzer';
import { VoiceStatus } from './types';
import { getBrowserInfo } from './utils/deviceDetection';
import { cn } from '../../lib/utils';
import { AlertCircle, Send, Keyboard, MessageSquare } from 'lucide-react';
import { Message } from './types';
import { AvatarCanvasRef } from './AvatarCanvas';

interface VoiceModeProps {
  onSwitchToChat: () => void;
  isVoiceSupported: boolean;
  theme?: 'light' | 'dark';
  avatarUrl?: string;
  bookingId: number;
  modelUrl?: string;
  animationPaths?: { idle: string; talking: string; waving: string; thinking: string; };
  backgroundColor?: string;
  messages: Message[];
  sendMessage: (content: string) => Promise<string | null>;
  isLoading: boolean;
  error: string | null;
  parentAvatarRef?: React.RefObject<AvatarCanvasRef | null>;
}

export const VoiceMode: React.FC<VoiceModeProps> = ({
  onSwitchToChat,
  isVoiceSupported,
  theme = 'dark',
  avatarUrl,
  bookingId,
  modelUrl,
  animationPaths,
  messages,
  sendMessage,
  isLoading,
  error: chatError,
  parentAvatarRef,
}) => {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [interimText, setInterimText] = useState('');
  const [responseText, setResponseText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [browserInfo] = useState(() => getBrowserInfo());
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState('');

  // Sync chat error
  useEffect(() => {
    if (chatError) setError(chatError);
  }, [chatError]);

  // Lip Sync
  const { initWithSpeechSynthesis } = useLipSync({
    onLipSyncUpdate: useCallback((value: number) => {
      parentAvatarRef?.current?.setLipSync(value);
    }, [parentAvatarRef]),
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
    lipSyncAnim.current?.stop();
    parentAvatarRef?.current?.playIdle();
  }, [parentAvatarRef]);

  const { speak, cancel: cancelSpeech, isSpeaking } = useSpeechSynthesis({
    onStart: () => {
      setStatus('speaking');
      parentAvatarRef?.current?.playTalking();
      lipSyncAnim.current?.start();
    },
    onEnd: handleSpeechEnd,
  });

  const handleSpeechResult = useCallback(
    async (transcript: string) => {
      setInterimText('');
      setStatus('processing');
      parentAvatarRef?.current?.playThinking();

      const response = await sendMessage(transcript);
      if (response) {
        setResponseText(response);
        speak(response);
      } else {
        setStatus('idle');
        parentAvatarRef?.current?.playIdle();
      }
    },
    [sendMessage, speak, parentAvatarRef]
  );

  const {
    isListening,
    startListening,
    stopListening,
  } = useSpeechRecognition({
    onResult: handleSpeechResult,
    onInterim: setInterimText,
    onError: (err) => {
      setError(err);
      setStatus('idle');
    },
  });

  const volume = useAudioAnalyzer(isListening);

  useEffect(() => {
    if (isListening) setStatus('listening');
  }, [isListening]);

  useEffect(() => {
    if (isLoading) setStatus('processing');
  }, [isLoading]);

  const toggleListening = useCallback(() => {
    if (isSpeaking) cancelSpeech();
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
    parentAvatarRef?.current?.playThinking();

    if (isSpeaking) cancelSpeech();

    const response = await sendMessage(message);
    if (response) {
      setResponseText(response);
      speak(response);
    } else {
      setStatus('idle');
      parentAvatarRef?.current?.playIdle();
    }
  }, [textInput, status, isSpeaking, cancelSpeech, sendMessage, speak, parentAvatarRef]);

  const getStatusText = () => {
    switch (status) {
      case 'idle': return isListening ? 'Listening...' : 'Tap to talk';
      case 'listening': return 'Go ahead, I\'m listening';
      case 'processing': return 'Thinking...';
      case 'speaking': return 'Cassandra is speaking';
      default: return '';
    }
  };

  if (!browserInfo.isSupported) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div>
          <h3 className="font-semibold text-lg">Voice Not Supported</h3>
          <p className="text-sm text-muted-foreground mt-1">Please use Chrome or Edge browser.</p>
        </div>
        <Button onClick={onSwitchToChat} variant="outline">
          <MessageSquare className="h-4 w-4 mr-2" />
          Use Chat Instead
        </Button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col bg-transparent">
      {/* Top HUD: Empty to clear face */}

      {/* Top Right Actions */}
      <div className="absolute top-6 right-6 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={onSwitchToChat}
          className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-black/20 hover:bg-black/40 backdrop-blur-xl border border-white/5 text-white/50 hover:text-white transition-all shadow-2xl active:scale-95"
          title="Switch to Text Chat"
        >
          <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6" />
        </Button>
      </div>

      {/* Bottom Overlay Gradient (Darker at bottom for text readability) */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute bottom-0 left-0 right-0 h-[60%] bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
      </div>

      {/* Consolidated Bottom Region */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xl z-50 px-6 flex flex-col gap-4">

        {/* Captions / Subtitles Area (Settled just above controls) */}
        {(interimText || responseText) && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="max-h-32 overflow-y-auto no-scrollbar text-center px-4">
              <div className="text-base sm:text-lg md:text-xl font-medium leading-relaxed tracking-tight">
                {interimText && (
                  <span className="text-gray-400/60 italic font-light block mb-1 text-xs sm:text-sm">
                    "{interimText}"
                  </span>
                )}
                <span className="text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                  {responseText}
                </span>
                {status === 'speaking' && !responseText && (
                  <span className="inline-flex gap-1 ml-3">
                    <span className="w-1 h-1 bg-blue-500/80 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1 h-1 bg-blue-500/80 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1 h-1 bg-blue-500/80 rounded-full animate-bounce" />
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* HUD Status Indicator (Moved to bottom region) */}
        <div className="flex justify-center pointer-events-none">
          <div className={cn(
            "px-3 py-1 rounded-full backdrop-blur-xl border border-white/5 shadow-2xl transition-all duration-700 animate-in fade-in",
            status === 'listening' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
              status === 'speaking' ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                "bg-black/40 text-gray-500 opacity-40 scale-90"
          )}>
            <p className="font-bold tracking-[0.25em] uppercase text-[8px] sm:text-[9px]">
              {error ? (
                <span className="text-red-400 flex items-center gap-2">
                  <AlertCircle className="h-2 w-2" /> {error}
                </span>
              ) : (
                getStatusText()
              )}
            </p>
          </div>
        </div>

        {/* Input & Main Controls */}
        <div className="flex flex-col gap-4">
          {showTextInput && (
            <form onSubmit={handleTextSubmit} className="animate-in slide-in-from-bottom-4 fade-in duration-500 group">
              <div className="relative">
                <Input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type a message..."
                  disabled={status === 'processing' || status === 'speaking'}
                  className="bg-black/60 backdrop-blur-3xl border-white/5 focus-visible:ring-blue-500/30 text-white h-12 rounded-xl px-4 pr-14 shadow-2xl ring-1 ring-white/10 placeholder:text-gray-600 text-sm"
                  autoFocus
                />
                <Button
                  type="submit"
                  size="icon"
                  className="absolute right-1.5 top-1.5 h-9 w-9 rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-lg transition-all active:scale-90 disabled:opacity-30"
                  disabled={!textInput.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          )}

          <div className="flex items-center justify-between bg-black/60 backdrop-blur-3xl border border-white/5 rounded-[2rem] p-2 shadow-2xl ring-1 ring-white/10">
            <div className="flex-1" />

            {/* Center: Reactive Mic Button (Shrunken for minimalist look) */}
            <div className="relative group mx-4">
              <div className={cn(
                "absolute inset-0 rounded-full blur-2xl transition-all duration-700",
                isListening ? "bg-blue-500/40 opacity-100" :
                  status === 'speaking' ? "bg-purple-500/40 opacity-30" : "opacity-0 bg-white/5"
              )} style={{ transform: isListening ? `scale(${1 + volume * 0.6})` : 'scale(1)' }} />

              <Button
                size="lg"
                onClick={toggleListening}
                disabled={status === 'processing' || showTextInput}
                className={cn(
                  'relative h-14 w-14 sm:h-16 sm:w-16 rounded-full shadow-2xl border-[3px] transition-all duration-700 overflow-hidden',
                  isListening ? 'bg-blue-600/30 border-blue-400' :
                    status === 'speaking' ? 'bg-purple-600/30 border-purple-400' :
                      'bg-blue-600/10 border-blue-500/30'
                )}
              >
                <WaveformVisualizer
                  isActive={true}
                  mode={isListening ? 'listening' : status === 'speaking' ? 'speaking' : 'idle'}
                  volume={volume}
                  className="w-full h-12 sm:h-14"
                />
              </Button>
            </div>

            <div className="flex-1" />
          </div>
        </div>
      </div>
    </div>
  );
};
