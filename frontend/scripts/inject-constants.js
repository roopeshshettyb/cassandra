const fs = require('fs');
const path = require('path');

// Injects branding into public/ by default — what the dev server serves, so `npm start`
// shows the tenant brand. `npm run build` passes `build` explicitly to rewrite the
// compiled output instead. Running it against public/ rewrites tracked files.
// Usage: node scripts/inject-constants.js [targetDir]   (default: public)
// path.resolve so an absolute targetDir works too — path.join would glue it onto the app dir.
const targetDir = path.resolve(path.join(__dirname, '..'), process.argv[2] || 'public');

const constantsPath = path.join(__dirname, '..', 'src', 'constants.json');
const indexPath = path.join(targetDir, 'index.html');
const manifestPath = path.join(targetDir, 'manifest.json');
// The service worker lives in public/ and is copied verbatim, so it cannot import
// constants.json — its notification icon has to be injected here like the HTML.
const serviceWorkerPath = path.join(targetDir, 'service-worker.js');

for (const required of [indexPath, manifestPath]) {
  if (!fs.existsSync(required)) {
    console.error(`✗ ${required} not found. For the build output, run this after react-scripts build.`);
    process.exit(1);
  }
}

const constants = JSON.parse(fs.readFileSync(constantsPath, 'utf8'));
const indexHtml = fs.readFileSync(indexPath, 'utf8');

// No fallbacks here: defaults belong in the backend's constants.service.ts (frontend/.claude/rules/constants.md).
const { APP_NAME, TAGLINE, DESCRIPTION, PROD_FRONTEND_URL, THEME_COLOR, LOGO, HERO } = constants;

// A key the backend has not shipped yet would inject the literal string "undefined" — and the
// validation gate below would still pass, since content="undefined" is a match. Catch it here.
// LOGO and HERO are injected unguarded below, so they belong here too: a payload without
// them would ship href="undefined" and still satisfy the gate.
const missingConstants = Object.entries({
  APP_NAME,
  TAGLINE,
  DESCRIPTION,
  PROD_FRONTEND_URL,
  THEME_COLOR,
  LOGO,
  HERO,
  // Not injected here, but the bundle reads them: LANDING_HERO_* would render a broken
  // src, and theme/index.js dereferences THEME_DEFAULTS at import time, so a payload
  // without it white-screens the app. Fail the build instead of shipping that.
  LANDING_HERO_VIDEO: constants.LANDING_HERO_VIDEO,
  LANDING_HERO_POSTER: constants.LANDING_HERO_POSTER,
  THEME_DEFAULTS: constants.THEME_DEFAULTS,
})
  .filter(([, value]) => !value)
  .map(([key]) => key);

// A half-populated THEME_DEFAULTS is as fatal as a missing one — every key below is
// dereferenced somewhere in App.js or theme/index.js.
const THEME_KEYS = [
  'PRIMARY_COLOR',
  'SECONDARY_COLOR',
  'NAVY_COLOR',
  'NAVY_LIGHT_COLOR',
  'PRIMARY_HOVER_COLOR',
  'BACKGROUND_DEFAULT_LIGHT',
  'BACKGROUND_DEFAULT_DARK',
  'BACKGROUND_PAPER_LIGHT',
  'BACKGROUND_PAPER_DARK',
  'FONT_FAMILY',
];
if (constants.THEME_DEFAULTS) {
  for (const key of THEME_KEYS) {
    if (!constants.THEME_DEFAULTS[key]) missingConstants.push(`THEME_DEFAULTS.${key}`);
  }
}

if (missingConstants.length) {
  console.error(`✗ constants.json is missing: ${missingConstants.join(', ')}. Is the backend up to date?`);
  process.exit(1);
}

// Landing.css derives its body text, secondary text, borders and shadows from NAVY_COLOR,
// so a light value there silently drops secondary text below WCAG AA rather than failing.
// 0.15 admits every plausible dark surface colour (#1B2340 is 0.018, #00695C is 0.109) and
// rejects mid-greys, where the derived text stops being readable.
const NAVY_MAX_LUMINANCE = 0.15;
const relativeLuminance = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const channel = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(m[1].slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const navyColor = constants.THEME_DEFAULTS.NAVY_COLOR;
const navyLuminance = relativeLuminance(navyColor);
if (navyLuminance !== null && navyLuminance > NAVY_MAX_LUMINANCE) {
  console.error(
    `✗ THEME_NAVY_COLOR (${navyColor}) is too light (luminance ${navyLuminance.toFixed(3)} > ${NAVY_MAX_LUMINANCE}). ` +
    'It is the landing page\'s dark surface and its text colours derive from it. Use a darker colour.',
  );
  process.exit(1);
}

// The build minifies `" />` down to `"/>`, so tag-closing whitespace has to be optional here.
const selfClosing = (attrs) => new RegExp(`<${attrs}\\s*/?>`);

let updatedHtml = indexHtml
  .replace(/<title>.*?<\/title>/, `<title>${APP_NAME} - ${TAGLINE}</title>`)
  // Both icons take LOGO, not HERO: they render as small squares, and HERO is a wide social
  // card that would be squashed. HERO stays on og:/twitter: image only.
  .replace(selfClosing('link rel="icon" href="[^"]*"'), `<link rel="icon" href="${LOGO}" />`)
  .replace(selfClosing('link rel="apple-touch-icon" href="[^"]*"'), `<link rel="apple-touch-icon" href="${LOGO}" />`)
  .replace(selfClosing('meta name="theme-color" content="[^"]*"'), `<meta name="theme-color" content="${THEME_COLOR}" />`)
  .replace(/property="og:title" content="[^"]*"/, `property="og:title" content="${APP_NAME} - ${TAGLINE}"`)
  .replace(/property="og:description" content="[^"]*"/, `property="og:description" content="${DESCRIPTION}"`)
  .replace(/property="og:url" content="[^"]*"/, `property="og:url" content="${PROD_FRONTEND_URL}"`)
  .replace(/property="og:image" content="[^"]*"/, `property="og:image" content="${HERO}"`)
  .replace(/property="og:image:secure_url" content="[^"]*"/, `property="og:image:secure_url" content="${HERO}"`)
  .replace(/property="og:image:alt" content="[^"]*"/, `property="og:image:alt" content="${APP_NAME} - ${TAGLINE}"`)
  .replace(/property="og:site_name" content="[^"]*"/, `property="og:site_name" content="${APP_NAME}"`)
  .replace(/name="twitter:title" content="[^"]*"/, `name="twitter:title" content="${APP_NAME} - ${TAGLINE}"`)
  .replace(/name="twitter:description" content="[^"]*"/, `name="twitter:description" content="${DESCRIPTION}"`)
  .replace(/name="twitter:image" content="[^"]*"/, `name="twitter:image" content="${HERO}"`)
  .replace(/name="twitter:image:alt" content="[^"]*"/, `name="twitter:image:alt" content="${APP_NAME} - ${TAGLINE}"`)
  .replace(/name="description" content="[^"]*"/, `name="description" content="${DESCRIPTION}"`);

// A regex that stops matching would silently ship stale branding — the exact failure this
// whole change exists to prevent. Fail the build instead.
// Each needle carries its own rel/name, so a successful favicon swap cannot vouch for a
// failed apple-touch-icon even though both now inject the same LOGO value.
const expected = [
  [`<title>${APP_NAME} - ${TAGLINE}</title>`, 'title'],
  [`<link rel="icon" href="${LOGO}" />`, 'favicon'],
  [`<link rel="apple-touch-icon" href="${LOGO}" />`, 'apple-touch-icon'],
  [`<meta name="theme-color" content="${THEME_COLOR}" />`, 'theme-color'],
  [`property="og:url" content="${PROD_FRONTEND_URL}"`, 'og:url'],
  [`property="og:image" content="${HERO}"`, 'og:image'],
];
const missed = expected.filter(([needle]) => !updatedHtml.includes(needle)).map(([, name]) => name);
if (missed.length) {
  console.error(`✗ Injection did not apply to: ${missed.join(', ')}. The index.html markup likely changed — update the patterns in this script.`);
  process.exit(1);
}

fs.writeFileSync(indexPath, updatedHtml);
console.log(`✓ Constants injected into ${path.relative(path.join(__dirname, '..'), indexPath)}`);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.short_name = APP_NAME;
manifest.name = `${APP_NAME} - ${TAGLINE}`;
manifest.description = DESCRIPTION;
if (constants.PWA_ID) manifest.id = constants.PWA_ID;
if (THEME_COLOR) manifest.theme_color = THEME_COLOR;
// Maps a file name or URL to its servable image type. Shared by icons and screenshots.
const mimeFor = (src) => {
  const ext = src.split('?')[0].split('.').pop().toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'svg') return 'image/svg+xml';
  if (ext === 'webp') return 'image/webp';
  return null;
};

// Install icons: sizes/purpose stay as declared, only the source swaps.
const iconSources = { '192x192': constants.PWA_ICON_192, '512x512': constants.PWA_ICON_512 };
if (Array.isArray(manifest.icons)) {
  manifest.icons.forEach((icon) => {
    const src = iconSources[icon.sizes];
    if (!src) return;
    icon.src = src;
    const type = mimeFor(src);
    if (type) icon.type = type;
  });
}
// Install-prompt screenshots: same treatment as the icons, keyed by form factor. Left
// untouched when the backend serves no source, so an older payload keeps the committed
// placeholder rather than shipping src="undefined".
const screenshotSources = { narrow: constants.PWA_SCREENSHOT_NARROW, wide: constants.PWA_SCREENSHOT_WIDE };
if (Array.isArray(manifest.screenshots)) {
  manifest.screenshots.forEach((s) => {
    if (s.form_factor === 'narrow') s.label = `${APP_NAME} Mobile View`;
    if (s.form_factor === 'wide') s.label = `${APP_NAME} Desktop View`;
    const src = screenshotSources[s.form_factor];
    if (!src) return;
    s.src = src;
    const type = mimeFor(src);
    if (type) s.type = type;
  });
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`✓ Constants injected into ${path.relative(path.join(__dirname, '..'), manifestPath)}`);

// Push notifications shown from the service worker (background/mobile) get the brand logo
// instead of the static favicon.
if (fs.existsSync(serviceWorkerPath)) {
  const originalSw = fs.readFileSync(serviceWorkerPath, 'utf8');
  const updatedSw = originalSw
    .replace(/icon: '[^']*'/, `icon: '${LOGO}'`)
    .replace(/badge: '[^']*'/, `badge: '${LOGO}'`);

  if (!updatedSw.includes(`icon: '${LOGO}'`) || !updatedSw.includes(`badge: '${LOGO}'`)) {
    console.error('✗ Injection did not apply to the service worker notification icon/badge. Check the patterns in this script against service-worker.js.');
    process.exit(1);
  }

  fs.writeFileSync(serviceWorkerPath, updatedSw);
  console.log(`✓ Constants injected into ${path.relative(path.join(__dirname, '..'), serviceWorkerPath)}`);
} else {
  console.log('• No service-worker.js in build output, skipping notification icon injection');
}
