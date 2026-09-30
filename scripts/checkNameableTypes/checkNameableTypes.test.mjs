import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {after, describe, it} from 'node:test';
import {fileURLToPath} from 'node:url';

const script = fileURLToPath(new URL('../checkNameableTypes.mjs', import.meta.url));

describe('checkNameableTypes.mjs', () => {
  const dirs = [];

  after(() => {
    for (const dir of dirs) {
      fs.rmSync(dir, {recursive: true, force: true});
    }
  });

  // runs the script in a throwaway directory that holds the declaration files, with
  // `index.d.ts` as the entry
  /** @param {Record<string, string>} files */
  function run(files) {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'checkNameableTypes-script-')));
    dirs.push(dir);
    for (const [name, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, name), content);
    }
    return spawnSync(process.execPath, [script, 'index.d.ts'], {cwd: dir, encoding: 'utf8'});
  }

  const hidden = {
    'a.d.ts': 'export interface Hidden { x: number }\nexport declare function f(): Hidden;\n',
    'index.d.ts': "export { f } from './a.js';\n",
  };

  it('reports a declaration it cannot name: exit code 1', () => {
    const {status, stderr} = run(hidden);

    assert.equal(status, 1, stderr);
    assert.match(stderr, /a\.d\.ts:1 {2}Hidden {2}<- reached from f/);
    assert.match(stderr, /1 not nameable/);
    assert.match(stderr, /add it to ACCEPTED/);
  });

  it('passes a surface whose names are all nameable: exit code 0', () => {
    const {status, stdout, stderr} = run({
      'index.d.ts': 'export interface A { x: number }\nexport declare function f(): A;\n',
    });

    assert.equal(status, 0, stderr);
    assert.match(stdout, /0 not nameable/);
  });

  it('stops with a message on an entry that does not exist: exit code 2, no stack trace', () => {
    const {status, stderr} = run({});

    assert.equal(status, 2, stderr);
    assert.match(stderr, /checkNameableTypes: no such entry declaration file/);
    assert.doesNotMatch(stderr, /^\s+at /m);
  });
});
