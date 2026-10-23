// The library's specs read fixtures at runtime — bitmap fonts, atlas JSON, images, the
// graphs of `presetGraphs.spec.ts` — from `src/**/fixtures/`, and Nx replays a cached
// result of `test`, `coverage` and `allocations` as long as their inputs hash the same.
// This spec holds those inputs to every file git tracks under `packages/twopoint5d/src/`,
// so a changed fixture runs its specs again.

import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {it} from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '../..');
// resolves through the `./bin/*.js` export of nx to its CLI; started with this node, it
// needs no shell and no pnpm shim on any platform
const nxBin = createRequire(path.join(repoRoot, 'package.json')).resolve('nx/bin/nx.js');

const tracked = execFileSync('git', ['ls-files', '-z', '--', 'packages/twopoint5d/src'], {
  cwd: repoRoot,
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean);

for (const target of ['test', 'coverage', 'allocations']) {
  it(`every tracked file under packages/twopoint5d/src is an input of twopoint5d:${target}`, () => {
    const {files} = JSON.parse(
      execFileSync(process.execPath, [nxBin, 'show', 'target', 'inputs', `twopoint5d:${target}`, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
        // a spec starts no background daemon
        env: {...process.env, NX_DAEMON: 'false'},
      }),
    );
    const inputs = new Set(files);
    assert.deepEqual(
      tracked.filter((file) => !inputs.has(file)),
      [],
      `these tracked files under packages/twopoint5d/src are no input of twopoint5d:${target}, so a change to them leaves an old result in the Nx cache; widen the inputs of the target in packages/twopoint5d/project.json`,
    );
  });
}
