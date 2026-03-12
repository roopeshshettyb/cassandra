// Initialize CSS variables with defaults so they're available before React renders
if (typeof document !== 'undefined') {
  const r = document.documentElement.style;
  r.setProperty('--app-gold-gradient', 'linear-gradient(135deg, #D4AF37 0%, #C5A022 100%)');
  r.setProperty('--app-navy-gradient', 'linear-gradient(135deg, #1B2340 0%, #263462 100%)');
  r.setProperty('--app-navy', '#1B2340');
  r.setProperty('--app-primary', '#D4AF37');
  r.setProperty('--app-secondary', '#C5A022');
  r.setProperty('--app-primary-contrast', '#000000');
}

// All components import these — they resolve via CSS variables so they
// automatically update when the hotel's themeConfig changes.
export const GOLD_GRADIENT = 'var(--app-gold-gradient)';
export const NAVY_GRADIENT = 'var(--app-navy-gradient)';
export const NAVY = 'var(--app-navy)';
export const PRIMARY_CONTRAST = 'var(--app-primary-contrast)';
export const MUTED = '#888888';
export const BG = '#F8F7F4';
