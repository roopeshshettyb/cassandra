// Initialize CSS variables with defaults so they're available before React renders
if (typeof document !== 'undefined') {
  const r = document.documentElement.style;
  r.setProperty('--app-brand-gradient', 'linear-gradient(135deg, #D4AF37 0%, #C5A022 100%)');
  r.setProperty('--app-navy-gradient', 'linear-gradient(135deg, #1B2340 0%, #263462 100%)');
  r.setProperty('--app-navy', '#1B2340');
  r.setProperty('--app-primary', '#D4AF37');
  r.setProperty('--app-secondary', '#C5A022');
  r.setProperty('--app-primary-contrast', '#000000');
  r.setProperty('--app-border', 'rgba(0,0,0,0.07)');
  r.setProperty('--app-nav-bg', 'rgba(255,255,255,0.8)');
}

// All components import these — they resolve via CSS variables so they
// automatically update when the hotel's themeConfig changes.
export const BRAND_GRADIENT = 'var(--app-brand-gradient)';
export const NAVY_GRADIENT = 'var(--app-navy-gradient)';
export const NAVY = 'var(--app-navy)';
export const PRIMARY_CONTRAST = 'var(--app-primary-contrast)';
export const BORDER = 'var(--app-border)';
export const NAV_BG = 'var(--app-nav-bg)';
export const MUTED = '#888888';
export const BG = '#F8F7F4';
export const SHADOW = '0 2px 8px rgba(0,0,0,0.06)';
export const SHADOW_HOVER = '0 6px 20px rgba(0,0,0,0.1)';
export const SHADOW_BRAND = '0 2px 8px rgba(197,160,34,0.3)';

export const STATUS_SUCCESS = '#059669';
export const STATUS_SUCCESS_BG = 'rgba(5,150,105,0.1)';
export const STATUS_INFO = '#2563EB';
export const STATUS_INFO_BG = 'rgba(37,99,235,0.1)';
export const STATUS_WARNING = '#C5A022';
export const STATUS_WARNING_BG = 'rgba(212,175,55,0.12)';
export const STATUS_ERROR = '#DC2626';
export const STATUS_ERROR_BG = 'rgba(220,38,38,0.1)';
export const BACKDROP_BG = 'rgba(0,0,0,0.5)';
export const HOVER_BG = 'rgba(0,0,0,0.04)';
export const TEXT_MUTED_LIGHT = 'rgba(255,255,255,0.7)';
export const TEXT_MUTED_DARK = 'rgba(136,136,136,0.7)';

// Legacy alias to prevent immediate breakage
export const GOLD_GRADIENT = BRAND_GRADIENT;
