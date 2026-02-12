import React, { useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { useThreeScene } from './hooks/useThreeScene';
import { detectDevice } from './utils/deviceDetection';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Loader2, RotateCcw } from 'lucide-react';

interface AvatarCanvasProps {
  avatarUrl: string;
  className?: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
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
  function AvatarCanvas({ avatarUrl, className, onLoad, onError }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    // Compute device capabilities once
    const [deviceCapabilities] = useState(() => detectDevice());

    const { playWaving, playTalking, playIdle, playThinking, resetCamera, setLipSync } = useThreeScene({
      containerRef,
      avatarUrl,
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
      <div className={cn('relative w-full h-full', className)}>
        <div
          ref={containerRef}
          className="w-full h-full"
          role="img"
          aria-label="3D Avatar"
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Loading avatar...</span>
            </div>
          </div>
        )}
      </div>
    );
  }
);

