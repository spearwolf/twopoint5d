import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {after, describe, it} from 'node:test';
import {fileURLToPath} from 'node:url';

const script = fileURLToPath(new URL('../makePackageJson.mjs', import.meta.url));

describe('makePackageJson.mjs', () => {
  const dirs = [];

  after(() => {
    for (const dir of dirs) {
      fs.rmSync(dir, {recursive: true, force: true});
    }
  });

  // runs the script in a throwaway project directory; it reads the workspace root from its own
  // path and the project from the working directory, and writes only to `<dir>/dist/`
  function run(peerDependencies) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'makePackageJson-script-'));
    dirs.push(dir);
    // without `dist/` the write itself fails with exit code 1, and the test could not tell the
    // guard from a crash
    fs.mkdirSync(path.join(dir, 'dist'));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({name: '@scope/probe', version: '1.0.0', peerDependencies}));
    const result = spawnSync(process.execPath, [script], {cwd: dir, encoding: 'utf8'});
    return {...result, manifestPath: path.join(dir, 'dist', 'package.json')};
  }

  it('refuses a specifier npm cannot install: exit code 1, no manifest written', () => {
    const {status, stderr, manifestPath} = run({three: 'catalog:nope'});
    assert.equal(status, 1, stderr);
    assert.equal(fs.existsSync(manifestPath), false);
    assert.match(stderr, /peerDependencies\.three is "catalog:nope"/);
  });

  it('writes the manifest when every specifier is a version range', () => {
    const {status, stderr, manifestPath} = run({three: '^0.185.0'});
    assert.equal(status, 0, stderr);
    assert.equal(fs.existsSync(manifestPath), true);
    assert.equal(JSON.parse(fs.readFileSync(manifestPath, 'utf8')).peerDependencies.three, '^0.185.0');
  });
});
