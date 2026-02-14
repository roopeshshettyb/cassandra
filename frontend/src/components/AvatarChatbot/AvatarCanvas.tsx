import React, { useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { useThreeScene } from './hooks/useThreeScene';
import { Box } from '@mui/material';

interface AvatarCanvasProps {
  avatarUrl: string;
  className?: string;
  animationPaths?: {
    idle: string;
    talking: string;
    waving: string;
    thinking: string;
  };
  onLoad?: () => void;
  onError?: (error: Error) => void;
  backgroundColor?: string;
  isMobile?: boolean;
}

export interface AvatarCanvasRef {
  playWaving: () => void;
  playTalking: () => void;
  playIdle: () => void;
  playThinking: () => void;
  resetCamera: () => void;
  setLipSync: (value: number) => void;
}

export const AvatarCanvas = forwardRef<AvatarCanvasRef, AvatarCanvasProps>(function AvatarCanvas({ avatarUrl, className, animationPaths, onLoad, onError, backgroundColor, isMobile = false }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Derive capabilities from isMobile prop
  const [deviceCapabilities] = useState(() => ({
    isMobile,
    isTablet: false, // Simplified as App.js mainly tracks mobile vs desktop
    isDesktop: !isMobile,
    pixelRatio: isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    targetFPS: isMobile ? 30 : 60,
  }));

  const { playWaving, playTalking, playIdle, playThinking, resetCamera, setLipSync } = useThreeScene({
    containerRef,
    avatarUrl,
    animationPaths,
    backgroundColor,
    deviceCapabilities,
    onLoad: () => {
      setIsLoading(false);
      onLoad?.();
    },
    onError: (error) => {
      setIsLoading(false);
      onError?.(error);
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      playWaving,
      playTalking,
      playIdle,
      playThinking,
      resetCamera,
      setLipSync,
    }),
    [playWaving, playTalking, playIdle, playThinking, resetCamera, setLipSync],
  );

  return (
    <Box className={className} sx={{ width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </Box>
  );
});
