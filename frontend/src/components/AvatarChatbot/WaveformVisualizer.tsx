import React, { useRef, useEffect, useCallback } from 'react';
import { cn } from 'lib/utils';

interface WaveformVisualizerProps {
  isActive: boolean;
  mode: 'idle' | 'listening' | 'speaking';
  className?: string;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  isActive,
  mode,
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const barsRef = useRef<number[]>(Array(30).fill(0));
  const velocitiesRef = useRef<number[]>(Array(30).fill(0));

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const bars = barsRef.current;
    const velocities = velocitiesRef.current;
    const barCount = bars.length;
    const barWidth = (width / barCount) * 0.7;
    const gap = (width / barCount) * 0.3;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Determine target heights based on mode
    bars.forEach((_, i) => {
      let targetHeight: number;
      
      if (!isActive || mode === 'idle') {
        // Gentle ambient wave
        targetHeight = 0.1 + Math.sin(Date.now() * 0.002 + i * 0.5) * 0.05;
      } else if (mode === 'listening') {
        // Active listening pattern
        targetHeight = 0.2 + Math.sin(Date.now() * 0.004 + i * 0.3) * 0.3 + Math.random() * 0.2;
      } else {
        // Speaking pattern - more dynamic
        targetHeight = 0.3 + Math.sin(Date.now() * 0.006 + i * 0.4) * 0.4 + Math.random() * 0.3;
      }

      // Spring physics for smooth animation
      const springStrength = 0.08;
      const damping = 0.75;
      
      velocities[i] += (targetHeight - bars[i]) * springStrength;
      velocities[i] *= damping;
      bars[i] += velocities[i];
      bars[i] = Math.max(0.05, Math.min(1, bars[i]));
    });

    // Draw bars with gradient
    bars.forEach((barHeight, i) => {
      const x = i * (barWidth + gap) + gap / 2;
      const actualHeight = barHeight * height * 0.8;
      const y = (height - actualHeight) / 2;

      // Create gradient
      const gradient = ctx.createLinearGradient(x, y + actualHeight, x, y);
      
      if (mode === 'speaking') {
        gradient.addColorStop(0, 'hsl(271, 91%, 65%)'); // Purple
        gradient.addColorStop(1, 'hsl(217, 91%, 60%)'); // Blue
      } else if (mode === 'listening') {
        gradient.addColorStop(0, 'hsl(217, 91%, 60%)'); // Blue
        gradient.addColorStop(1, 'hsl(192, 91%, 55%)'); // Cyan
      } else {
        gradient.addColorStop(0, 'hsl(215, 20%, 45%)'); // Muted
        gradient.addColorStop(1, 'hsl(215, 20%, 55%)');
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, actualHeight, barWidth / 2);
      ctx.fill();
    });

    animationRef.current = requestAnimationFrame(draw);
  }, [isActive, mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    // Start animation
    animationRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={cn('w-full h-16', className)}
      aria-label={`Audio visualizer - ${mode}`}
      role="img"
    />
  );
};

