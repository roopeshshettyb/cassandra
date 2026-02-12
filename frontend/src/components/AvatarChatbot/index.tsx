import React, { useState, useCallback, useRef } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { AvatarCanvas, AvatarCanvasRef } from './AvatarCanvas';
import { VoiceMode } from './VoiceMode';
import { ChatMode } from './ChatMode';
import { AvatarChatbotProps, ChatMode as ChatModeType } from './types';
import { getBrowserInfo } from './utils/deviceDetection';
import { cn } from '../../lib/utils';
import { Mic, MessageSquare } from 'lucide-react';

const AVATAR_OPTIONS = [
  { id: 'cassandra', name: 'Cassandra', url: '/model/casendra.glb' },
  { id: 'model1', name: 'Model 1', url: '/model/Model1.glb' },
  { id: 'model2', name: 'Model 2', url: '/model/model2.glb' },
];

const DEFAULT_AVATAR_URL = AVATAR_OPTIONS[0].url;

export const AvatarChatbot: React.FC<AvatarChatbotProps> = ({
  theme = 'dark',
  position = 'center',
  avatarUrl: initialAvatarUrl = DEFAULT_AVATAR_URL,
}) => {
  const [mode, setMode] = useState<ChatModeType>('initial');
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState(initialAvatarUrl);
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

  return (
    <div className={cn('flex flex-col items-center justify-center w-full h-full p-4 md:p-6', theme === 'dark' && 'dark')}>
      <Card
        className={cn(
          'w-full overflow-hidden transition-all duration-300 flex flex-col',
          'bg-background/80 backdrop-blur-xl border-border/50',
          'shadow-2xl',
          // Mobile: Almost full screen for better avatar visibility
          'h-[92vh] md:h-[600px] lg:h-[700px]',
          // Desktop: Wider
          'max-w-md md:max-w-2xl lg:max-w-4xl',
          isTransitioning && 'opacity-50 scale-98'
        )}
      >
        {/* Initial Mode - Avatar with mode selection */}
        {mode === 'initial' && (
          <div className="flex flex-col h-full">
            {/* Avatar Display */}
            <div className="flex-1 relative min-h-[50%] md:min-h-[60%]">
              <AvatarCanvas
                key="initial-avatar"
                ref={avatarRef}
                avatarUrl={selectedAvatarUrl}
                className="rounded-t-lg"
              />

              {/* Gradient overlay at bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background via-background/80 to-transparent" />
            </div>

            {/* Content Container */}
            <div className="flex flex-col p-6 gap-6 z-10 -mt-20 md:-mt-10">
              {/* Welcome Text */}
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">How can I help you?</h2>
                <p className="text-muted-foreground">Choose a mode to start the conversation</p>
              </div>

              {/* Avatar Selection Pills */}
              <div className="flex flex-wrap justify-center gap-2 px-4">
                {AVATAR_OPTIONS.map((option) => (
                  <Button
                    key={option.id}
                    variant={selectedAvatarUrl === option.url ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedAvatarUrl(option.url)}
                    className={cn(
                      "h-8 rounded-full px-4 transition-all duration-300",
                      selectedAvatarUrl === option.url
                        ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20"
                        : "bg-background/50 backdrop-blur-sm border-border/50 hover:bg-accent/50"
                    )}
                  >
                    {option.name}
                  </Button>
                ))}
              </div>

              {/* Mode Selection Buttons */}
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

              {!browserInfo.isSupported && (
                <p className="text-xs text-center text-muted-foreground">
                  Voice features require Chrome or Edge browser
                </p>
              )}
            </div>
          </div>
        )}

        {/* Voice Mode */}
        {mode === 'voice' && (
          <VoiceMode
            avatarUrl={selectedAvatarUrl}
            onSwitchToChat={() => handleModeChange('chat')}
            theme={theme}
            avatarOptions={AVATAR_OPTIONS}
            onAvatarChange={setSelectedAvatarUrl}
          />
        )}

        {/* Chat Mode */}
        {mode === 'chat' && (
          <ChatMode
            onSwitchToVoice={() => handleModeChange('voice')}
            isVoiceSupported={browserInfo.isSupported}
            theme={theme}
          />
        )}
      </Card>

      {/* Footer / Branding */}
      <div className="mt-4 text-xs text-muted-foreground/50 text-center">
        Powered by Vibe-Chat & Gemini
      </div>
    </div>
  );
};

export default AvatarChatbot;
export type { AvatarChatbotProps };

