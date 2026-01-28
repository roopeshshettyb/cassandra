const fs = require('fs');
const path = require('path');

const constantsPath = path.join(__dirname, '..', 'src', 'constants.json');
const indexPath = path.join(__dirname, '..', 'public', 'index.html');

if (!fs.existsSync(constantsPath)) {
  console.error('Constants file not found. Run fetch-constants first.');
  process.exit(1);
}

const constants = JSON.parse(fs.readFileSync(constantsPath, 'utf8'));
const indexHtml = fs.readFileSync(indexPath, 'utf8');

const APP_NAME = constants.APP_NAME || 'Aura';
const TAGLINE = constants.TAGLINE || 'Capture Social Media Aura';
const DESCRIPTION = constants.DESCRIPTION || 'Transform profile pictures and headers into powerful advertising spaces. Reach millions where they engage most.';
const FRONTEND_URL = process.env.REACT_APP_FRONTEND_URL || 'http://localhost:6768';

let updatedHtml = indexHtml
  .replace(/<title>.*?<\/title>/, `<title>${APP_NAME} - ${TAGLINE}</title>`)
  .replace(/property="og:title" content="[^"]*"/, `property="og:title" content="${APP_NAME} - ${TAGLINE}"`)
  .replace(/property="og:description" content="[^"]*"/, `property="og:description" content="${DESCRIPTION}"`)
  .replace(/property="og:url" content="[^"]*"/, `property="og:url" content="${FRONTEND_URL}"`)
  .replace(/property="og:image" content="[^"]*"/, `property="og:image" content="${FRONTEND_URL}/hero.png"`)
  .replace(/property="og:image:secure_url" content="[^"]*"/, `property="og:image:secure_url" content="${FRONTEND_URL}/hero.png"`)
  .replace(/property="og:image:alt" content="[^"]*"/, `property="og:image:alt" content="${APP_NAME} - ${TAGLINE}"`)
  .replace(/property="og:site_name" content="[^"]*"/, `property="og:site_name" content="${APP_NAME}"`)
  .replace(/name="twitter:title" content="[^"]*"/, `name="twitter:title" content="${APP_NAME} - ${TAGLINE}"`)
  .replace(/name="twitter:description" content="[^"]*"/, `name="twitter:description" content="${DESCRIPTION}"`)
  .replace(/name="twitter:image" content="[^"]*"/, `name="twitter:image" content="${FRONTEND_URL}/hero.png"`)
  .replace(/name="twitter:image:alt" content="[^"]*"/, `name="twitter:image:alt" content="${APP_NAME} - ${TAGLINE}"`)
  .replace(/name="description" content="[^"]*"/, `name="description" content="${DESCRIPTION}"`);

fs.writeFileSync(indexPath, updatedHtml);
console.log('✓ Constants injected into index.html');
