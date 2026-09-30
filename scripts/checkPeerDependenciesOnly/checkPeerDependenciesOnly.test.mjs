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

  function run(packageJsonText, files = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'checkPeerDependenciesOnly-'));
    dirs.push(dir);
    if (packageJsonText !== undefined) {
      fs.writeFileSync(path.join(dir, 'package.json'), packageJsonText);
    }
    for (const [file, content] of Object.entries(files)) {
      const target = path.join(dir, file);
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.writeFileSync(target, content);
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

  it('refuses a package whose code imports a package outside its peer dependencies: exit code 1, message names file and specifier', () => {
    const {status, stderr} = run(JSON.stringify({peerDependencies: {three: '~0.185.1'}}), {
      'lib/a.js': "import {x} from 'tslib';\n",
    });
    assert.equal(status, 1, stderr);
    assert.match(stderr, /lib\/a\.js imports tslib; the library ships with peer dependencies only/);
  });

  it('passes a package whose code imports only peers and relative paths, in .js and .d.ts alike', () => {
    const {status, stderr} = run(JSON.stringify({peerDependencies: {three: '~0.185.1'}}), {
      'lib/a.js': "import {x} from 'three/webgpu';\nimport {y} from './b.js';\n",
      'lib/a.d.ts': "export type T = import('three/webgpu').Mesh;\n",
    });
    assert.equal(status, 0, stderr);
    assert.equal(stderr, '');
  });

  it('skips files below node_modules', () => {
    const {status, stderr} = run(JSON.stringify({peerDependencies: {three: '~0.185.1'}}), {
      'node_modules/x/index.js': "import _ from 'lodash';\n",
    });
    assert.equal(status, 0, stderr);
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
