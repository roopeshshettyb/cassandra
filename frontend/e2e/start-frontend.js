/**
 * Builds the frontend against the test backend, as `npm run build` does for production, and
 * serves it. The build goes to e2e/.build so the regular build/ folder is left alone.
 */
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { FRONTEND_DIR, FRONTEND_ENV, FRONTEND_PORT, BUILD_DIR } = require('./settings');

const env = { ...process.env, ...FRONTEND_ENV };
const run = (command) => execSync(command, { cwd: FRONTEND_DIR, env, stdio: 'inherit' });

// fetch-constants rewrites the tracked src/constants.json; put it back once the bundle has it. The
// committed copy waits on disk, so a run killed mid-build (Ctrl+C) is put right by the next one.
const constantsPath = path.join(FRONTEND_DIR, 'src', 'constants.json');
const backupPath = path.join(__dirname, '.constants.json');
if (fs.existsSync(backupPath)) fs.copyFileSync(backupPath, constantsPath);
fs.copyFileSync(constantsPath, backupPath);
try {
  run('npm run fetch-constants');
  run('npx react-scripts build');
  run(`node scripts/inject-constants.js "${BUILD_DIR}"`);
} finally {
  fs.copyFileSync(backupPath, constantsPath);
  fs.rmSync(backupPath);
}

const serve = path.join(FRONTEND_DIR, 'node_modules', 'serve', 'build', 'main.js');
const server = spawn(process.execPath, [serve, '-s', BUILD_DIR, '-l', String(FRONTEND_PORT), '--no-request-logging', '--no-port-switching'], { cwd: FRONTEND_DIR, env, stdio: 'inherit' });
server.on('exit', (code) => process.exit(code ?? 0));
