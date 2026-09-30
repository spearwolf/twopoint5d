import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
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
});
