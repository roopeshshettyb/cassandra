import React, { useMemo } from 'react';
import { cn } from '../../lib/utils';

interface WaveformVisualizerProps {
  isActive: boolean;
  mode: 'idle' | 'listening' | 'speaking';
  volume?: number;
  className?: string;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  isActive,
  mode,
  volume = 0,
  className,
}) => {
  // Dense bars for a high-fidelity look
  const barCount = 40;

  // Dev.to Logic: Each bar gets a unique animation frequency (duration)
  // This creates a complex interference pattern rather than a simple pulse.
  const bars = useMemo(() => Array.from({ length: barCount }).map((_, i) => {
    // Spread durations from 0.6s to 2.4s to create the unsynced effect
    const duration = 0.6 + (i * 0.05);

    return {
      index: i,
      duration: `${duration.toFixed(2)}s`,
    };
  }), [barCount]);

  // Vibrant color from user reference
  const barColorClass = mode === 'speaking' ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]' : 'bg-[#f32968] shadow-[0_0_8px_rgba(243,41,104,0.5)]';

  return (
    <div className={cn("flex items-center justify-center gap-[1.5px] w-full h-full pb-1", className)}>
      <div className="flex items-center justify-center gap-[1px] h-full w-full max-w-[140px]">
        {bars.map((bar) => {
          // Reactive reactivity: scale the base height based on volume if listening
          const listeningScale = mode === 'listening' ? 1 + (volume * 1.5) : 1;

          return (
            <div
              key={bar.index}
              className={cn(
                "w-[1px] min-w-[1px] h-4 rounded-full animate-waveform transition-opacity duration-500",
                barColorClass,
                !isActive && "opacity-30"
              )}
              style={{
                // Custom property used by animate-waveform class
                '--wave-duration': bar.duration,
                transform: `scaleY(${listeningScale})`,
                // Stagger slightly so they don't all start at the same phase
                animationDelay: `-${(bar.index * 0.1).toFixed(2)}s`,
              } as React.CSSProperties}
            />
          );
        })}
      </div>
    </div>
  );
};
