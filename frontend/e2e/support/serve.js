// Serves the UI-test build (e2e/build) as the SPA host would: a file if it exists, else index.html.
// Usage: node e2e/support/serve.js <port>
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '../build');
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.glb': 'model/gltf-binary',
  '.fbx': 'application/octet-stream',
  '.gif': 'image/gif',
};

http
  .createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const target = file.startsWith(ROOT + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(ROOT, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(target)] || 'application/octet-stream' });
    fs.createReadStream(target)
      .on('error', () => res.end())
      .pipe(res);
  })
  .listen(Number(process.argv[2]));
