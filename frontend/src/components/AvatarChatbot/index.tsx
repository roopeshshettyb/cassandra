import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { AvatarCanvas, AvatarCanvasRef } from './AvatarCanvas';
import { VoiceMode } from './VoiceMode';
import { ChatMode } from './ChatMode';
import { AvatarChatbotProps, ChatMode as ChatModeType } from './types';
import { getBrowserInfo } from './utils/deviceDetection';
import { cn } from '../../lib/utils';
import { Mic, MessageSquare } from 'lucide-react';
import { useSocketChat } from './hooks/useSocketChat';

const DEFAULT_AVATAR_URL = 'https://models.readyplayer.me/698df165d9645a11b117e2fc.glb';

export const AvatarChatbot: React.FC<AvatarChatbotProps & { initialMode?: ChatModeType }> = ({
  theme = 'dark',
  position = 'center',
  avatarUrl: initialAvatarUrl = DEFAULT_AVATAR_URL,
  bookingId,
  initialMode = 'initial',
}) => {
  const [mode, setMode] = useState<ChatModeType>(initialMode);

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode]);

  // Use modelUrl from backend if available, fallback to initialAvatarUrl
  const [isTransitioning, setIsTransitioning] = useState(false);
  const avatarRef = useRef<AvatarCanvasRef>(null);
  const browserInfo = getBrowserInfo();

  const handleModeChange = useCallback((newMode: ChatModeType) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setMode(newMode);
      setIsTransitioning(false);
    }, 300);
  }, []);

  const positionClasses = {
    center: 'mx-auto',
    'bottom-right': 'fixed bottom-4 right-4 z-50',
    'bottom-left': 'fixed bottom-4 left-4 z-50',
  };

  const { messages, isLoading, error, sendMessage } = useSocketChat(bookingId);
  const [avatarConfig, setAvatarConfig] = useState<{
    modelUrl: string;
    animationPaths: {
      idle: string;
      talking: string;
      waving: string;
      thinking: string;
    };
    backgroundColor?: string;
  } | null>(null);

  const activeAvatarUrl = avatarConfig?.modelUrl || initialAvatarUrl;

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const token = localStorage.getItem('token'); // Assuming JWT auth
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000'}/avatar-config/${bookingId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setAvatarConfig(data);
        }
      } catch (err) {
        console.error('Failed to fetch avatar config:', err);
      }
    };

    if (bookingId) {
      fetchConfig();
    }
  }, [bookingId]);

  return (
    <div className={cn('flex flex-col items-center justify-center w-full h-full p-4 md:p-6', theme === 'dark' && 'dark')}>
      <Card
        className={cn(
          'w-full overflow-hidden transition-all duration-300 flex flex-col relative',
          'bg-background/80 backdrop-blur-xl border-border/50',
          'shadow-2xl',
          'h-[92vh] md:h-[600px] lg:h-[700px]',
          'max-w-md md:max-w-2xl lg:max-w-4xl',
          isTransitioning && 'opacity-50 scale-98'
        )}
      >
        {/* Persistent Avatar Canvas */}
        <div className={cn(
          "absolute inset-0 z-0 transition-all duration-700 ease-in-out",
          mode === 'initial' ? "h-[60%] top-0" : "h-full top-0"
        )}>
          <AvatarCanvas
            ref={avatarRef}
            avatarUrl={activeAvatarUrl}
            animationPaths={avatarConfig?.animationPaths}
            backgroundColor={avatarConfig?.backgroundColor || '#0f172a'}
            className="w-full h-full object-cover"
          />
          {/* Gradient overlay - adjusts based on mode */}
          <div className={cn(
            "absolute bottom-0 left-0 right-0 transition-all duration-700",
            mode === 'initial' ? "h-32 bg-gradient-to-t from-background via-background/80 to-transparent" : "h-64 bg-gradient-to-t from-black/80 via-black/40 to-transparent"
          )} />
        </div>

        {/* Overlay Content based on Mode */}
        {mode === 'initial' && (
          <div className="flex flex-col h-full relative z-10">
            <div className="flex-1" /> {/* Spacer for avatar */}
            <div className="flex flex-col p-6 gap-6 bg-gradient-to-t from-background via-background to-transparent pt-20">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">How can I help you?</h2>
                <p className="text-muted-foreground">Choose a mode to start the conversation</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md mx-auto">
                <Button
                  onClick={() => handleModeChange('voice')}
                  className={cn(
                    'flex-1 h-14 gap-3 text-lg',
                    'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700',
                    'text-white shadow-lg shadow-indigo-500/20',
                    !browserInfo.isSupported && 'opacity-50'
                  )}
                  disabled={!browserInfo.isSupported}
                >
                  <Mic className="h-5 w-5" />
                  Voice Mode
                </Button>

                <Button
                  onClick={() => handleModeChange('chat')}
                  variant="outline"
                  className="flex-1 h-14 gap-3 text-lg bg-background/50 backdrop-blur-sm border-2 hover:bg-accent/50"
                >
                  <MessageSquare className="h-5 w-5" />
                  Chat Mode
                </Button>
              </div>
            </div>
          </div>
        )}

        {mode === 'voice' && (
          <VoiceMode
            onSwitchToChat={() => handleModeChange('chat')}
            isVoiceSupported={browserInfo.isSupported}
            theme={theme}
            bookingId={bookingId}
            modelUrl={activeAvatarUrl}
            animationPaths={avatarConfig?.animationPaths}
            backgroundColor={avatarConfig?.backgroundColor}
            messages={messages}
            sendMessage={sendMessage}
            isLoading={isLoading}
            error={error}
            parentAvatarRef={avatarRef}
          />
        )}

        {mode === 'chat' && (
          <ChatMode
            onSwitchToVoice={() => handleModeChange('voice')}
            isVoiceSupported={browserInfo.isSupported}
            theme={theme}
            bookingId={bookingId}
            messages={messages}
            sendMessage={sendMessage}
            isLoading={isLoading}
            error={error}
          />
        )}
      </Card>
    </div>
  );
};

export default AvatarChatbot;
export type { AvatarChatbotProps };

