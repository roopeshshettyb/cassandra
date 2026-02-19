import React, { useState, useRef, useEffect } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { AvatarCanvas, AvatarCanvasRef } from './AvatarCanvas';
import { ChatMode } from './ChatMode';
import { AvatarChatbotProps, ChatMode as ChatModeType } from './types';
import { useSocketChat } from './hooks/useSocketChat';

import constants from '../../constants.json';

const DEFAULT_AVATAR_URL = 'https://models.readyplayer.me/698df165d9645a11b117e2fc.glb';
const { APP_NAME } = constants;

export const AvatarChatbot: React.FC<AvatarChatbotProps & { initialMode?: ChatModeType }> = ({
  theme = 'dark',
  position = 'center',
  avatarUrl: initialAvatarUrl = DEFAULT_AVATAR_URL,
  bookingId,
  initialMode = 'initial',
  isWithinStay = true,
  alertError,
}) => {
  const [mode] = useState<ChatModeType>('chat');

  useEffect(() => {
    // initialMode is ignored for now since we only support chat
  }, [initialMode]);

  // Use modelUrl from backend if available, fallback to initialAvatarUrl
  const [isTransitioning, setIsTransitioning] = useState(false);
  const avatarRef = useRef<AvatarCanvasRef>(null);

  const { messages, isLoading, error, sendMessage, addMessage } = useSocketChat(bookingId);
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

  if (!isWithinStay) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '60vh', width: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="h6">{APP_NAME} will help you with this booking</Typography>
        </Box>
        <Paper sx={{ p: 4, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body1" color="text.secondary" align="center">
            {APP_NAME} would be ready to talk to you as soon as you check in!
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      width: '100%', height: '100%', p: { xs: 2, md: 3 },
      bgcolor: theme === 'dark' ? '#0f172a' : 'transparent',
    }}>
      <Paper
        elevation={24}
        sx={{
          position: 'relative',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: 4,
          height: { xs: '92vh', md: '600px', lg: '700px' },
          maxWidth: { xs: '100%', md: '800px', lg: '1000px' },
          transition: 'all 0.3s',
          opacity: isTransitioning ? 0.5 : 1,
          transform: isTransitioning ? 'scale(0.98)' : 'scale(1)',
        }}
      >
        {/* Persistent Avatar Canvas */}
        <Box sx={{
          position: 'absolute', inset: 0, zIndex: 0, transition: 'all 0.7s ease-in-out',
          height: '100%', top: 0
        }}>
          <AvatarCanvas
            ref={avatarRef}
            avatarUrl={activeAvatarUrl}
            animationPaths={avatarConfig?.animationPaths}
            backgroundColor={avatarConfig?.backgroundColor || '#0f172a'}
            className=""
          />
        </Box>

        {/* Chat mode only */}
        <ChatMode
          onSwitchToVoice={undefined}
          isVoiceSupported={false}
          theme={theme}
          bookingId={bookingId}
          messages={messages}
          sendMessage={sendMessage}
          isLoading={isLoading}
          error={error}
        />
      </Paper>
    </Box>
  );
};

export default AvatarChatbot;

