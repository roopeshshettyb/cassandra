// Minimal utility functions for Avatar components

export function cn(...classes) {
    return classes.filter(Boolean).join(' ');
}

export function detectDevice() {
    const ua = navigator.userAgent || '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
        || window.innerWidth < 768;
    const isTablet = /iPad|Android/i.test(ua) && window.innerWidth >= 768 && window.innerWidth < 1024;
    const isDesktop = !isMobile && !isTablet;
    const pixelRatio = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const targetFPS = isMobile ? 30 : 60;

    return { isMobile, isTablet, isDesktop, pixelRatio, targetFPS };
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
        isEdge: name === 'Edge'
    };
}

export const isSpeechRecognitionSupported = () => {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
};

export const isSpeechSynthesisSupported = () => {
    return 'speechSynthesis' in window;
};
