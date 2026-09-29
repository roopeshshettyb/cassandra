const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// In a build container (Amplify, CI) REACT_APP_BACKEND_URL is exported in the environment and
// .env.development does not exist there — it is gitignored. Locally it comes from that file.
if (!process.env.REACT_APP_BACKEND_URL) {
  dotenv.config({ path: path.join(__dirname, '..', '.env.development') });
}

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

if (!BACKEND_URL) {
  console.error('✗ REACT_APP_BACKEND_URL is not set. Export it in the build environment, or add it to frontend/.env.development for local runs.');
  process.exit(1);
}

const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'constants.json');

function fetchConstants() {
  const url = new URL(`${BACKEND_URL}/constants/public`);
  const client = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.get(url.href, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const constants = JSON.parse(data);
            resolve(constants);
          } catch (error) {
            reject(new Error(`Failed to parse JSON: ${error.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message || error.code || error}`));
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function main() {
  try {
    console.log(`Fetching constants from ${BACKEND_URL}/constants/public...`);
    const constants = await fetchConstants();

    const outputDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(constants, null, 2));
    console.log(`✓ Constants written to ${OUTPUT_PATH}`);
    console.log('Constants:', JSON.stringify(constants, null, 2));
  } catch (error) {
    console.error('✗ Failed to fetch constants:', error.message);
    process.exit(1);
  }
}

main();
