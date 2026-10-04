import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {after, describe, it} from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';

const previewServerUrl = new URL('./previewServer.mjs', import.meta.url).href;

// stands in for astro preview: writes its pid where the spec can read it, then never answers
const STAND_IN = "require('node:fs').writeFileSync(process.argv[1], String(process.pid)); setInterval(() => {}, 1000);";

/** @param {number} pid */
const isAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** @param {() => boolean} condition */
async function waitFor(condition, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) return false;
    await delay(50);
  }
  return true;
}

describe('startPreviewServer()', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-server-'));
  const pidFile = path.join(dir, 'server.pid');
  let serverPid = 0;

  after(() => {
    if (serverPid && isAlive(serverPid)) process.kill(serverPid, 'SIGKILL');
    fs.rmSync(dir, {recursive: true, force: true});
  });

  it('takes the server down with the process when a Ctrl-C comes while the server still starts', async () => {
    // the generator's way out on a signal: process.exit(), with the server still starting
    const wrapper = spawn(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
          import {startPreviewServer} from ${JSON.stringify(previewServerUrl)};
          process.once('SIGINT', () => process.exit(130));
          await startPreviewServer({command: process.execPath, args: () => ['-e', ${JSON.stringify(STAND_IN)}, ${JSON.stringify(pidFile)}]});
        `,
      ],
      {stdio: 'ignore'},
    );

    assert.ok(
      await waitFor(() => fs.existsSync(pidFile) && fs.readFileSync(pidFile, 'utf8') !== ''),
      'the stand-in server started',
    );
    serverPid = Number(fs.readFileSync(pidFile, 'utf8'));
    assert.ok(isAlive(serverPid));

    const exited = new Promise((resolve) => wrapper.once('exit', resolve));
    wrapper.kill('SIGINT');
    assert.equal(await exited, 130);

    assert.ok(await waitFor(() => !isAlive(serverPid), 3000), `the server (pid ${serverPid}) outlived the process`);
  });
});
