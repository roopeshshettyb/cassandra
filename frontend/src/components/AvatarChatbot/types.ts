export interface AvatarChatbotProps {
  theme?: 'light' | 'dark';
  position?: 'center' | 'bottom-right' | 'bottom-left';
  avatarUrl?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export type ChatMode = 'initial' | 'voice' | 'chat';

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking';

export interface AudioAnalyzerData {
  frequencyData: number[];
  volume: number;
}

export interface DeviceCapabilities {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  pixelRatio: number;
  targetFPS: number;
}

export interface ThreeSceneConfig {
  container: HTMLElement;
  avatarUrl: string;
  deviceCapabilities: DeviceCapabilities;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

export interface LipSyncConfig {
  intensity: number;
  smoothing: number;
}
