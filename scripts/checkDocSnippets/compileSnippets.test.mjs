import assert from 'node:assert/strict';
import path from 'node:path';
import {test} from 'node:test';
import {compileSnippets} from './compileSnippets.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const anchorDir = path.join(repoRoot, 'packages', 'twopoint5d-testing');
const tsconfigPath = path.join(repoRoot, 'tsconfig.json');

const compile = (...snippets) =>
  compileSnippets({
    snippets: snippets.map((snippet) => ({file: 'a.md', line: 1, indent: 0, ...snippet})),
    anchorDir,
    tsconfigPath,
  });

test('maps a diagnostic back to the line and column in the markdown file', () => {
  const diagnostics = compile({line: 10, indent: 2, code: "const n: number = 'x';"});

  assert.equal(diagnostics.length, 1);
  const [diagnostic] = diagnostics;
  assert.equal(diagnostic.file, 'a.md');
  assert.equal(diagnostic.code, 2322);
  assert.equal(diagnostic.line, 10);
  // `n` sits at index 6 of the code line, plus one for 1-based columns, plus the fence indentation
  assert.equal(diagnostic.column, 9);
  assert.match(diagnostic.message, /not assignable/);
});

test('every snippet is a module of its own', () => {
  assert.deepEqual(compile({code: 'const a = 1;'}, {code: 'const a = 1;'}), []);
});

test('unused locals and parameters are fine', () => {
  assert.deepEqual(compile({code: 'const unused = 1;\nexport function f(x: number) {}'}), []);
});

test('the strictness of the root config applies, noUncheckedIndexedAccess included', () => {
  const diagnostics = compile({code: 'const xs: string[] = [];\nconst s: string = xs[0];'});

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].code, 2322);
  assert.equal(diagnostics[0].line, 2);
});

test('a diagnostic is attributed to the snippet it belongs to', () => {
  const diagnostics = compile(
    {file: 'a.md', line: 3, code: 'const a = 1;'},
    {file: 'b.md', line: 40, code: "const b: number = 'x';"},
  );

  assert.deepEqual(
    diagnostics.map(({file, line}) => ({file, line})),
    [{file: 'b.md', line: 40}],
  );
});
