// Minimal utility functions for Avatar components

export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function getBrowserInfo() {
  const isSpeechRecognitionSupported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  const isSpeechSynthesisSupported = 'speechSynthesis' in window;

  const hasFeatureSupport = isSpeechRecognitionSupported && isSpeechSynthesisSupported;

  const ua = navigator.userAgent;
  let name = 'Unknown';
  if (ua.includes('Chrome') && !ua.includes('Edge')) name = 'Chrome';
  else if (ua.includes('Edg')) name = 'Edge';
  else if (ua.includes('Firefox')) name = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) name = 'Safari';

  return {
    name,
    isSupported: hasFeatureSupport,
    isChrome: name === 'Chrome',
    isEdge: name === 'Edge',
  };
}

export const isSpeechRecognitionSupported = () => {
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
};

export const isSpeechSynthesisSupported = () => {
  return 'speechSynthesis' in window;
};
