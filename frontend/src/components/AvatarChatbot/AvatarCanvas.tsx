import React, { useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { useThreeScene } from './hooks/useThreeScene';
import { detectDevice } from '../../helper/utils';
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
}

export interface AvatarCanvasRef {
  playWaving: () => void;
  playTalking: () => void;
  playIdle: () => void;
  playThinking: () => void;
  resetCamera: () => void;
  setLipSync: (value: number) => void;
}

export const AvatarCanvas = forwardRef<AvatarCanvasRef, AvatarCanvasProps>(
  function AvatarCanvas({ avatarUrl, className, animationPaths, onLoad, onError, backgroundColor }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [deviceCapabilities] = useState(() => detectDevice());

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

    useImperativeHandle(ref, () => ({
      playWaving,
      playTalking,
      playIdle,
      playThinking,
      resetCamera,
      setLipSync,
    }), [playWaving, playTalking, playIdle, playThinking, resetCamera, setLipSync]);

    return (
      <Box className={className} sx={{ width: '100%', height: '100%' }}>
        <div
          ref={containerRef}
          style={{ width: '100%', height: '100%' }}
        />
      </Box>
    );
  }
);
