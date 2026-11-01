import constants from '../constants.json';

// The palette lives in the backend's constants.service.ts (general rules, "Constants and defaults"), so this file
// must not carry fallback colours: a fallback would quietly paint a white-labeled tenant in the
// previous brand instead of surfacing a stale constants.json. Assert instead. constants.json is
// generated — `npm start` and `npm run build` both run fetch-constants first, and
// inject-constants.js re-checks every key before a build ships.
if (!constants.THEME_DEFAULTS) {
  throw new Error('constants.json has no THEME_DEFAULTS. It is generated — run `npm run fetch-constants` against a backend that serves it.');
}

// Initialize CSS variables so they're available before React renders. Values come from the
// backend palette in constants.json — App.js re-applies them once a hotel theme loads.
if (typeof document !== 'undefined') {
  const r = document.documentElement.style;
  const t = constants.THEME_DEFAULTS;
  r.setProperty('--app-brand-gradient', `linear-gradient(135deg, ${t.PRIMARY_COLOR} 0%, ${t.SECONDARY_COLOR} 100%)`);
  r.setProperty('--app-navy-gradient', `linear-gradient(135deg, ${t.NAVY_COLOR} 0%, ${t.NAVY_LIGHT_COLOR} 100%)`);
  r.setProperty('--app-navy', t.NAVY_COLOR);
  r.setProperty('--app-navy-light', t.NAVY_LIGHT_COLOR);
  r.setProperty('--app-primary', t.PRIMARY_COLOR);
  r.setProperty('--app-primary-hover', t.PRIMARY_HOVER_COLOR);
  r.setProperty('--app-secondary', t.SECONDARY_COLOR);
  r.setProperty('--app-bg', t.BACKGROUND_DEFAULT_LIGHT);
  r.setProperty('--app-primary-contrast', '#000000');
  r.setProperty('--app-navy-contrast', '#ffffff');
  r.setProperty('--app-border', 'rgba(0,0,0,0.07)');
  r.setProperty('--app-nav-bg', 'rgba(255,255,255,0.8)');
}

// All components import these — they resolve via CSS variables so they
// automatically update when the hotel's themeConfig changes.
export const BRAND_GRADIENT = 'var(--app-brand-gradient)';
export const NAVY_GRADIENT = 'var(--app-navy-gradient)';
export const NAVY = 'var(--app-navy)';
export const PRIMARY_CONTRAST = 'var(--app-primary-contrast)';
export const NAVY_CONTRAST = 'var(--app-navy-contrast)';
export const BORDER = 'var(--app-border)';
export const NAV_BG = 'var(--app-nav-bg)';
export const MUTED = '#888888';
export const BG = 'var(--app-bg)';
export const SHADOW = '0 2px 8px rgba(0,0,0,0.06)';
export const SHADOW_HOVER = '0 6px 20px rgba(0,0,0,0.1)';
export const SHADOW_PANEL = '0 24px 48px rgba(0,0,0,0.06)';
export const SHADOW_BRAND = '0 2px 8px color-mix(in srgb, var(--app-secondary) 30%, transparent)';

export const STATUS_SUCCESS = '#059669';
export const STATUS_SUCCESS_BG = 'rgba(5,150,105,0.1)';
export const STATUS_INFO = '#2563EB';
export const STATUS_INFO_BG = 'rgba(37,99,235,0.1)';
// Semantic, not brand-derived — success/info/error are fixed too. Tying warning to the
// palette collides on a tenant whose brand is green or red: a "Pending" badge would render
// the same colour as "Completed". This amber is the default brand's own secondary, so the
// unconfigured deployment looks unchanged.
export const STATUS_WARNING = '#C5A022';
export const STATUS_WARNING_BG = 'rgba(197,160,34,0.1)';
export const STATUS_ERROR = '#DC2626';
export const STATUS_ERROR_BG = 'rgba(220,38,38,0.1)';
// Text and icons on a solid status colour.
export const STATUS_CONTRAST = '#ffffff';
export const BACKDROP_BG = 'rgba(0,0,0,0.5)';
export const HOVER_BG = 'rgba(0,0,0,0.04)';
export const TEXT_MUTED_LIGHT = 'rgba(255,255,255,0.7)';
// Fainter still — watermark letters and hairlines on a dark hero.
export const TEXT_FAINT_LIGHT = 'rgba(255,255,255,0.35)';
export const TEXT_MUTED_DARK = 'rgba(136,136,136,0.7)';

// Legacy alias to prevent immediate breakage
export const GOLD_GRADIENT = BRAND_GRADIENT;
