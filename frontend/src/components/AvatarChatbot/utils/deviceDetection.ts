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
  const hasFeatureSupport = isSpeechRecognitionSupported() && isSpeechSynthesisSupported();

  let name = 'Unknown';
  if (userAgent.includes('Chrome') && !userAgent.includes('Edge')) name = 'Chrome';
  else if (userAgent.includes('Edg')) name = 'Edge';
  else if (userAgent.includes('Firefox')) name = 'Firefox';
  else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) name = 'Safari';

  // Support is now based on whether the required APIs exist, not just the string "Chrome"
  return {
    name,
    isSupported: hasFeatureSupport
  };
}
