const fs = require('fs');
const path = require('path');

const constantsPath = path.join(__dirname, '..', 'src', 'constants.json');
const indexPath = path.join(__dirname, '..', 'public', 'index.html');
const manifestPath = path.join(__dirname, '..', 'public', 'manifest.json');

const constants = JSON.parse(fs.readFileSync(constantsPath, 'utf8'));
const indexHtml = fs.readFileSync(indexPath, 'utf8');

const APP_NAME = constants.APP_NAME || 'Aura';
const TAGLINE = constants.TAGLINE || 'Capture Social Media Aura';
const DESCRIPTION = constants.DESCRIPTION || 'Transform profile pictures and headers into powerful advertising spaces. Reach millions where they engage most.';
const PROD_FRONTEND_URL = constants.PROD_FRONTEND_URL;

let updatedHtml = indexHtml
  .replace(/<title>.*?<\/title>/, `<title>${APP_NAME} - ${TAGLINE}</title>`)
  .replace(/<link rel="icon" href="[^"]*" \/>/, `<link rel="icon" href="${constants.HERO}" />`)
  .replace(/property="og:title" content="[^"]*"/, `property="og:title" content="${APP_NAME} - ${TAGLINE}"`)
  .replace(/property="og:description" content="[^"]*"/, `property="og:description" content="${DESCRIPTION}"`)
  .replace(/property="og:url" content="[^"]*"/, `property="og:url" content="${PROD_FRONTEND_URL}"`)
  .replace(/property="og:image" content="[^"]*"/, `property="og:image" content="${constants.HERO}"`)
  .replace(/property="og:image:secure_url" content="[^"]*"/, `property="og:image:secure_url" content="${constants.HERO}"`)
  .replace(/property="og:image:alt" content="[^"]*"/, `property="og:image:alt" content="${APP_NAME} - ${TAGLINE}"`)
  .replace(/property="og:site_name" content="[^"]*"/, `property="og:site_name" content="${APP_NAME}"`)
  .replace(/name="twitter:title" content="[^"]*"/, `name="twitter:title" content="${APP_NAME} - ${TAGLINE}"`)
  .replace(/name="twitter:description" content="[^"]*"/, `name="twitter:description" content="${DESCRIPTION}"`)
  .replace(/name="twitter:image" content="[^"]*"/, `name="twitter:image" content="${constants.HERO}"`)
  .replace(/name="twitter:image:alt" content="[^"]*"/, `name="twitter:image:alt" content="${APP_NAME} - ${TAGLINE}"`)
  .replace(/name="description" content="[^"]*"/, `name="description" content="${DESCRIPTION}"`);

fs.writeFileSync(indexPath, updatedHtml);
console.log('✓ Constants injected into index.html');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.short_name = APP_NAME;
manifest.name = `${APP_NAME} - ${TAGLINE}`;
manifest.description = DESCRIPTION;
if (constants.PWA_ID) manifest.id = constants.PWA_ID;
if (Array.isArray(manifest.screenshots)) {
  manifest.screenshots.forEach((s) => {
    if (s.form_factor === 'narrow') s.label = `${APP_NAME} Mobile View`;
    if (s.form_factor === 'wide') s.label = `${APP_NAME} Desktop View`;
  });
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('✓ Constants injected into manifest.json');
