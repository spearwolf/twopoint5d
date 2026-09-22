// `checkDocSnippets.mjs` reads every tracked `*.md`, `project.json` names them by
// directory, and this spec holds the two lists together: a tracked Markdown file that
// falls outside those globs could turn its `ts check` block red without invalidating
// the typecheck target's cache.

import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {it} from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '../..');
// resolves through the `./bin/*.js` export of nx to its CLI; started with this node, it needs
// no shell and no pnpm shim on any platform
const nxBin = createRequire(path.join(repoRoot, 'package.json')).resolve('nx/bin/nx.js');

it('every tracked Markdown file is an input of twopoint5d-testing:typecheck', () => {
  const tracked = execFileSync('git', ['ls-files', '-z', '--', '*.md'], {cwd: repoRoot, encoding: 'utf8'})
    .split('\0')
    .filter(Boolean);
  const {files} = JSON.parse(
    execFileSync(process.execPath, [nxBin, 'show', 'target', 'inputs', 'twopoint5d-testing:typecheck', '--json'], {
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
    'these tracked Markdown files are no input of twopoint5d-testing:typecheck, so a `ts check` block in them could turn red without invalidating the cache; add a glob for them to the typecheck inputs in packages/twopoint5d-testing/project.json',
  );
});
