import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {after, test} from 'node:test';
import ts from 'typescript';
import {readCompilerOptions} from './readCompilerOptions.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'readCompilerOptions-')));

after(() => fs.rmSync(dir, {recursive: true, force: true}));

test('reads the root tsconfig with the values the compiler uses', () => {
  const options = readCompilerOptions(path.join(repoRoot, 'tsconfig.json'));

  assert.equal(options.strict, true);
  assert.equal(options.noUncheckedIndexedAccess, true);
  assert.equal(options.moduleResolution, ts.ModuleResolutionKind.Bundler);
});

test('an unreadable tsconfig throws with its path', () => {
  assert.throws(() => readCompilerOptions(path.join(dir, 'no-such-tsconfig.json')), /cannot read .*no-such-tsconfig\.json/);
});

test('an unknown compiler option value throws', () => {
  const tsconfigPath = path.join(dir, 'tsconfig.json');
  fs.writeFileSync(tsconfigPath, JSON.stringify({compilerOptions: {module: 'banana'}}));

  assert.throws(() => readCompilerOptions(tsconfigPath), /invalid compiler options in/);
});
