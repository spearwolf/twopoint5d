import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {describe, it} from 'node:test';
import {fileURLToPath} from 'node:url';

const script = fileURLToPath(new URL('../nxCacheServer.mjs', import.meta.url));

// every call here fails before the server listens; the timeout only catches a script
// that would start serving after all
const run = (args) =>
  spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: {...process.env, NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN: 'secret'},
    timeout: 10_000,
  });

describe('nxCacheServer.mjs', () => {
  it('names an option it does not know, then prints the usage line: exit code 1', () => {
    const {status, stderr} = run(['--dri', 'cache', '--port', '0']);
    assert.equal(status, 1, stderr);
    assert.match(stderr, /'--dri'[^\n]*\nusage: /);
  });

  it('prints the usage line alone when --dir is missing: exit code 1', () => {
    const {status, stderr} = run(['--port', '0']);
    assert.equal(status, 1, stderr);
    assert.match(stderr, /^usage: [^\n]*\n$/);
  });

  it('prints the usage line alone for a port that is no whole number from 0 to 65535, and creates no --dir: exit code 1', () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'nx-cache-server-'));
    const dir = path.join(parent, 'cache');
    try {
      for (const port of ['70000', '65536', '-1', '']) {
        const {status, stderr} = run(['--dir', dir, `--port=${port}`]);
        assert.equal(status, 1, `--port=${port}: ${stderr}`);
        assert.match(stderr, /^usage: [^\n]*\n$/, `--port=${port}`);
        assert.equal(fs.existsSync(dir), false, `--port=${port} created --dir`);
      }
    } finally {
      fs.rmSync(parent, {recursive: true, force: true});
    }
  });
});
