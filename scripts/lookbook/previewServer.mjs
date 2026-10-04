// Starts `astro preview` of the built lookbook on a free port, for the preview generator.
import {spawn} from 'node:child_process';
import net from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';

const lookbookDir = fileURLToPath(new URL('../../apps/lookbook/', import.meta.url));
// `base` in apps/lookbook/astro.config.mjs
const BASE_PATH = '/lookbook';
const STARTUP_TIMEOUT_MS = 30_000;

/** @returns {Promise<number>} */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

/** @returns {Promise<{baseUrl: string, stop: () => void}>} */
export async function startPreviewServer() {
  const port = await findFreePort();
  // --ignore-lock: without it Astro 7 refuses a second preview server next to one already
  // running, and moves the server into the background on its own when an AI agent runs the
  // command, where stop() would not reach it.
  // A process group of its own: stop() ends pnpm, astro and whatever astro started, and a
  // Ctrl-C in the terminal reaches the generator only, which then stops the group
  const child = spawn('pnpm', ['exec', 'astro', 'preview', '--ignore-lock', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: lookbookDir,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk;
  });
  child.stderr.on('data', (chunk) => {
    output += chunk;
  });

  const stop = () => {
    if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      // the group is gone already
    }
  };

  const baseUrl = `http://127.0.0.1:${port}${BASE_PATH}`;
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`astro preview exited with code ${child.exitCode}:\n${output}`);
    }
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.ok) return {baseUrl, stop};
    } catch {
      // not listening yet
    }
    await delay(250);
  }
  stop();
  throw new Error(`astro preview did not answer at ${baseUrl}/ within ${STARTUP_TIMEOUT_MS} ms:\n${output}`);
}
