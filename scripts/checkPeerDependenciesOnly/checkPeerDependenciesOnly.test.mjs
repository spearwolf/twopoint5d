import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {after, describe, it} from 'node:test';
import {fileURLToPath} from 'node:url';

const script = fileURLToPath(new URL('../checkPeerDependenciesOnly.mjs', import.meta.url));

describe('checkPeerDependenciesOnly.mjs', () => {
  const dirs = [];

  after(() => {
    for (const dir of dirs) {
      fs.rmSync(dir, {recursive: true, force: true});
    }
  });

  function run(packageJsonText) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'checkPeerDependenciesOnly-'));
    dirs.push(dir);
    if (packageJsonText !== undefined) {
      fs.writeFileSync(path.join(dir, 'package.json'), packageJsonText);
    }
    const result = spawnSync(process.execPath, [script, dir], {encoding: 'utf8'});
    return {...result, dir};
  }

  it('refuses a manifest with a runtime dependency: exit code 1, message names it', () => {
    const {status, stderr} = run(JSON.stringify({dependencies: {foo: '^1.0.0'}}));
    assert.equal(status, 1, stderr);
    assert.match(stderr, /declares dependencies\.foo; the library ships with peer dependencies only/);
  });

  it('passes a manifest with peer dependencies only: exit code 0, no stderr', () => {
    const {status, stderr} = run(JSON.stringify({peerDependencies: {three: '~0.185.1'}}));
    assert.equal(status, 0, stderr);
    assert.equal(stderr, '');
  });

  it('stops with a message when package.json is not JSON: exit code 1, no stack trace', () => {
    const {status, stderr} = run('{');
    assert.equal(status, 1, stderr);
    assert.match(stderr, /cannot read .*package\.json: /);
    assert.doesNotMatch(stderr, /^\s+at /m);
  });

  it('stops with a usage message when the argument is missing: exit code 1', () => {
    const result = spawnSync(process.execPath, [script], {encoding: 'utf8'});
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /^usage: /);
  });
});
