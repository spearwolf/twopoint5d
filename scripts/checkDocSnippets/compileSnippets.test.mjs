import assert from 'node:assert/strict';
import path from 'node:path';
import {test} from 'node:test';
import {compileSnippets} from './compileSnippets.mjs';
import {extractSnippets} from './extractSnippets.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const anchorDir = path.join(repoRoot, 'packages', 'twopoint5d-testing');
const tsconfigPath = path.join(repoRoot, 'tsconfig.json');

const compile = (...snippets) =>
  compileSnippets({
    snippets: snippets.map((snippet) => ({
      file: 'a.md',
      line: 1,
      offsets: (snippet.code ?? '').split('\n').map(() => 0),
      ...snippet,
    })),
    anchorDir,
    tsconfigPath,
  });

test('maps a diagnostic back to the line and column in the markdown file', () => {
  const diagnostics = compile({line: 10, offsets: [2], code: "const n: number = 'x';"});

  assert.equal(diagnostics.length, 1);
  const diagnostic = /** @type {(typeof diagnostics)[number]} */ (diagnostics[0]);
  assert.equal(diagnostic.file, 'a.md');
  assert.equal(diagnostic.code, 2322);
  assert.equal(diagnostic.line, 10);
  // `n` sits at index 6 of the code line, plus one for 1-based columns, plus what the code
  // line lost of its indentation
  assert.equal(diagnostic.column, 9);
  assert.match(diagnostic.message, /not assignable/);
});

test('maps the column of each line by what that line lost', () => {
  const diagnostics = compile({line: 10, offsets: [0, 1], code: "const a = 1;\nconst n: number = 'x';"});

  assert.equal(diagnostics.length, 1);
  const diagnostic = /** @type {(typeof diagnostics)[number]} */ (diagnostics[0]);
  assert.equal(diagnostic.line, 11);
  // `n` sits at index 6 of the code line, plus one for 1-based columns, plus the offset of the line
  assert.equal(diagnostic.column, 8);
});

test('a diagnostic in a tab-indented block of a list item points at the column of the Markdown line', () => {
  const markdown = ['- item', '', '\t```ts check', "\tconst n: number = 'x';", '\t```'].join('\n');
  const {snippets} = extractSnippets(markdown, 'a.md');
  const diagnostics = compileSnippets({snippets, anchorDir, tsconfigPath});

  assert.equal(diagnostics.length, 1);
  const diagnostic = /** @type {(typeof diagnostics)[number]} */ (diagnostics[0]);
  assert.equal(diagnostic.line, 4);
  // `n` sits at index 7 of the Markdown line: the tab, then `const `
  assert.equal(diagnostic.column, 8);
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
  const diagnostic = /** @type {(typeof diagnostics)[number]} */ (diagnostics[0]);
  assert.equal(diagnostic.code, 2322);
  assert.equal(diagnostic.line, 2);
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

test('an unreadable tsconfig throws even when no block is marked', () => {
  assert.throws(
    () => compileSnippets({snippets: [], anchorDir, tsconfigPath: path.join(repoRoot, 'no-such-tsconfig.json')}),
    /cannot read/,
  );
});
