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

// Legacy alias to prevent immediate breakage
export const GOLD_GRADIENT = BRAND_GRADIENT;
