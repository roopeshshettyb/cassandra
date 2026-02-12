import { DeviceCapabilities } from '../types';

export function detectDevice(): DeviceCapabilities {
  const userAgent = navigator.userAgent.toLowerCase();
  const width = window.innerWidth;
  const height = window.innerHeight;
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  // More robust tablet detection (e.g. iPads requesting desktop site)
  const isIPad = /macintosh/i.test(userAgent) && maxTouchPoints > 2;
  const isAndroidTablet = /android/i.test(userAgent) && !/mobile/i.test(userAgent);
  const isTablet = /ipad|tablet|playbook|silk/i.test(userAgent) || isIPad || isAndroidTablet || (width >= 768 && width < 1280 && maxTouchPoints > 0);

  const isMobile = !isTablet && (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(userAgent) || width < 768);
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
