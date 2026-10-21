// Starts `astro preview` of the built lookbook on a free port, for the preview generator.
import {spawn} from 'node:child_process';
import net from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';

const lookbookDir = fileURLToPath(new URL('../../apps/lookbook/', import.meta.url));
// `base` in apps/lookbook/astro.config.mjs
const BASE_PATH = '/lookbook';
const STARTUP_TIMEOUT_MS = 30_000;
// one probe of the server may take this long; a connection that hangs is given up and retried
const PROBE_TIMEOUT_MS = 2_000;

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

/**
 * @param {{command?: string, args?: (port: number) => string[], startupTimeoutMs?: number}} [server]
 *   what to start on the free port: astro preview of the lookbook, unless a spec hands in a
 *   stand-in; `startupTimeoutMs` is how long it may take to answer, which a spec shortens
 * @returns {Promise<{baseUrl: string, stop: () => void}>}
 */
export async function startPreviewServer({
  command = 'pnpm',
  args = (port) => ['exec', 'astro', 'preview', '--ignore-lock', '--host', '127.0.0.1', '--port', String(port)],
  startupTimeoutMs = STARTUP_TIMEOUT_MS,
} = {}) {
  const port = await findFreePort();
  // --ignore-lock: without it Astro 7 refuses a second preview server next to one already
  // running, and moves the server into the background on its own when an AI agent runs the
  // command, where stop() would not reach it.
  // A process group of its own: stop() ends pnpm, astro and whatever astro started, and a
  // Ctrl-C in the terminal reaches the generator only, which then stops the group
  const child = spawn(command, args(port), {
    cwd: lookbookDir,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  /** @type {Error | undefined} */
  let spawnError;
  // spawn() reports a command it cannot start (ENOENT, EACCES) as an 'error' event, and an
  // 'error' event without a listener ends the process with a raw stack trace
  child.on('error', (error) => {
    spawnError ??= error;
  });
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk;
  });
  child.stderr.on('data', (chunk) => {
    output += chunk;
  });

  const stop = () => {
    process.off('exit', stop);
    if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      // the group is gone already
    }
  };
  // from the spawn on, every way out of the process ends the group, a process.exit() while the
  // server still starts as well: the caller holds no stop() before this function returns
  process.once('exit', stop);

  const baseUrl = `http://127.0.0.1:${port}${BASE_PATH}`;
  const deadline = Date.now() + startupTimeoutMs;
  while (Date.now() < deadline) {
    // first: after ENOENT node sets exitCode to -2 as well, and "exited with code -2" says less
    if (spawnError) {
      stop();
      throw new Error(`could not start ${command}: ${spawnError.message}`);
    }
    if (child.exitCode !== null || child.signalCode !== null) {
      stop();
      const how = child.exitCode !== null ? `with code ${child.exitCode}` : `on signal ${child.signalCode}`;
      throw new Error(`astro preview exited ${how}:\n${output}`);
    }
    try {
      const response = await fetch(`${baseUrl}/`, {
        signal: AbortSignal.timeout(Math.max(1, Math.min(PROBE_TIMEOUT_MS, deadline - Date.now()))),
      });
      if (response.ok) return {baseUrl, stop};
    } catch {
      // not listening yet, or the probe ran out
    }
    await delay(250);
  }
  stop();
  throw new Error(`astro preview did not answer at ${baseUrl}/ within ${startupTimeoutMs} ms:\n${output}`);
}
