const fs = require('fs');
const path = require('path');

// Injects branding into the BUILD OUTPUT, not into public/. public/index.html and
// public/manifest.json are committed sources and stay untouched, so `npm start` and
// `npm run build` never dirty the working tree with local branding.
// Usage: node scripts/inject-constants.js [targetDir]   (default: build)
// path.resolve so an absolute targetDir works too — path.join would glue it onto the app dir.
const targetDir = path.resolve(path.join(__dirname, '..'), process.argv[2] || 'build');

const constantsPath = path.join(__dirname, '..', 'src', 'constants.json');
const indexPath = path.join(targetDir, 'index.html');
const manifestPath = path.join(targetDir, 'manifest.json');
// The service worker lives in public/ and is copied verbatim, so it cannot import
// constants.json — its notification icon has to be injected here like the HTML.
const serviceWorkerPath = path.join(targetDir, 'service-worker.js');

for (const required of [indexPath, manifestPath]) {
  if (!fs.existsSync(required)) {
    console.error(`✗ ${required} not found. Run this after react-scripts build.`);
    process.exit(1);
  }
}

const constants = JSON.parse(fs.readFileSync(constantsPath, 'utf8'));
const indexHtml = fs.readFileSync(indexPath, 'utf8');

// No fallbacks here: defaults belong in the backend's constants.service.ts (CLAUDE.md General #3).
const { APP_NAME, TAGLINE, DESCRIPTION, PROD_FRONTEND_URL, THEME_COLOR, LOGO, HERO } = constants;

// A key the backend has not shipped yet would inject the literal string "undefined" — and the
// validation gate below would still pass, since content="undefined" is a match. Catch it here.
// LOGO and HERO are injected unguarded below, so they belong here too: a payload without
// them would ship href="undefined" and still satisfy the gate.
const missingConstants = Object.entries({ APP_NAME, TAGLINE, DESCRIPTION, PROD_FRONTEND_URL, THEME_COLOR, LOGO, HERO })
  .filter(([, value]) => !value)
  .map(([key]) => key);
if (missingConstants.length) {
  console.error(`✗ constants.json is missing: ${missingConstants.join(', ')}. Is the backend up to date?`);
  process.exit(1);
}

// The build minifies `" />` down to `"/>`, so tag-closing whitespace has to be optional here.
const selfClosing = (attrs) => new RegExp(`<${attrs}\\s*/?>`);

let updatedHtml = indexHtml
  .replace(/<title>.*?<\/title>/, `<title>${APP_NAME} - ${TAGLINE}</title>`)
  // Both icons take LOGO, not HERO: they render as small squares, and HERO is a wide social
  // card that would be squashed. HERO stays on og:/twitter: image only.
  .replace(selfClosing('link rel="icon" href="[^"]*"'), `<link rel="icon" href="${LOGO}"/>`)
  .replace(selfClosing('link rel="apple-touch-icon" href="[^"]*"'), `<link rel="apple-touch-icon" href="${LOGO}"/>`)
  .replace(selfClosing('meta name="theme-color" content="[^"]*"'), `<meta name="theme-color" content="${THEME_COLOR}"/>`)
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
  [`<link rel="icon" href="${LOGO}"/>`, 'favicon'],
  [`<link rel="apple-touch-icon" href="${LOGO}"/>`, 'apple-touch-icon'],
  [`<meta name="theme-color" content="${THEME_COLOR}"/>`, 'theme-color'],
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
// Install icons: sizes/purpose stay as declared, only the source swaps.
const iconSources = { '192x192': constants.PWA_ICON_192, '512x512': constants.PWA_ICON_512 };
if (Array.isArray(manifest.icons)) {
  manifest.icons.forEach((icon) => {
    const src = iconSources[icon.sizes];
    if (!src) return;
    icon.src = src;
    const ext = src.split('?')[0].split('.').pop().toLowerCase();
    if (ext === 'jpg' || ext === 'jpeg') icon.type = 'image/jpeg';
    else if (ext === 'png') icon.type = 'image/png';
    else if (ext === 'svg') icon.type = 'image/svg+xml';
    else if (ext === 'webp') icon.type = 'image/webp';
  });
}
if (Array.isArray(manifest.screenshots)) {
  manifest.screenshots.forEach((s) => {
    if (s.form_factor === 'narrow') s.label = `${APP_NAME} Mobile View`;
    if (s.form_factor === 'wide') s.label = `${APP_NAME} Desktop View`;
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
