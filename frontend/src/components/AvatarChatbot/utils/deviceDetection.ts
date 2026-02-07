import { DeviceCapabilities } from '../types';

export function detectDevice(): DeviceCapabilities {
  const userAgent = navigator.userAgent.toLowerCase();
  const width = window.innerWidth;
  
  const isMobile = /mobile|android|iphone|ipod|blackberry|windows phone/i.test(userAgent) || width < 768;
  const isTablet = /ipad|tablet/i.test(userAgent) || (width >= 768 && width < 1024);
  const isDesktop = !isMobile && !isTablet;
  
  const pixelRatio = Math.min(window.devicePixelRatio || 1, isDesktop ? 2 : 1.5);
  const targetFPS = isMobile ? 30 : 60;
  
  return {
    isMobile,
    isTablet,
    isDesktop,
    pixelRatio,
    targetFPS,
  };
}

export function isSpeechRecognitionSupported(): boolean {
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

export function isSpeechSynthesisSupported(): boolean {
  return 'speechSynthesis' in window;
}

export function getBrowserInfo(): { name: string; isSupported: boolean } {
  const userAgent = navigator.userAgent;
  
  if (userAgent.includes('Chrome') && !userAgent.includes('Edge')) {
    return { name: 'Chrome', isSupported: true };
  }
  if (userAgent.includes('Edg')) {
    return { name: 'Edge', isSupported: true };
  }
  if (userAgent.includes('Firefox')) {
    return { name: 'Firefox', isSupported: false };
  }
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    return { name: 'Safari', isSupported: false };
  }
  
  return { name: 'Unknown', isSupported: false };
}
