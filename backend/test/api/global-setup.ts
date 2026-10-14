/**
 * Starts the backend for the API suites, so `npm run test:api` needs nothing running first.
 * A backend already answering on its port is used as is and left running. Settings: env.ts.
 */
import './env';
import { execFileSync, spawn } from 'child_process';
import * as path from 'path';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { ConstantsService } from '../../src/common/constants/constants.service';

const ROOT = path.join(__dirname, '../..');
const START_TIMEOUT_MS = 120000;

const isUp = (url: string) =>
  axios.get(url, { timeout: 2000 }).then(
    () => true,
    () => false,
  );

export default async function globalSetup(): Promise<void> {
  // The same port the suites call, defaults included.
  const port = new ConstantsService(new ConfigService()).private.BACKEND_PORT;
  const health = `http://localhost:${port}/health`;
  if (await isUp(health)) return;

  // The built entry point, as in production, so the suites test what ships.
  execFileSync(process.execPath, [path.join(ROOT, 'node_modules/@nestjs/cli/bin/nest.js'), 'build'], { cwd: ROOT, stdio: 'inherit' });
  // Errors reach the console, so a backend that fails to start says why.
  const server = spawn(process.execPath, [path.join(ROOT, 'dist/main.js')], { cwd: ROOT, env: process.env, stdio: ['ignore', 'ignore', 'inherit'] });
  // Jest runs the teardown in this same process, so it can find and stop the server here.
  const shared: any = globalThis;
  shared.__BACKEND__ = server;

  const deadline = Date.now() + START_TIMEOUT_MS;
  while (!(await isUp(health))) {
    // Jest skips the teardown when the setup fails, so a backend that never answered is stopped here.
    if (server.exitCode !== null || Date.now() > deadline) {
      server.kill();
      throw new Error(server.exitCode !== null ? `Backend exited with code ${server.exitCode} before answering ${health}` : `Backend did not answer ${health} within ${START_TIMEOUT_MS / 1000}s`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
