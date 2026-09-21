import assert from 'node:assert/strict';
import {test} from 'node:test';
import {extractSnippets} from './extractSnippets.mjs';

const FENCE = '```';

// a markdown document built from lines, so the fences do not fight the template literal
const doc = (...lines) => lines.join('\n');

test('finds a block marked `ts check`: line is the first code line, code carries no fences', () => {
  const {snippets, problems} = extractSnippets(
    doc('# Title', '', 'some prose', `${FENCE}ts check`, 'const a = 1;', 'const b = 2;', FENCE, 'after'),
    'a.md',
  );

  assert.deepEqual(problems, []);
  assert.deepEqual(snippets, [{file: 'a.md', line: 5, indent: 0, code: 'const a = 1;\nconst b = 2;'}]);
});

test('ignores blocks whose info string is `ts`, `js` or `json`', () => {
  const {snippets, problems} = extractSnippets(
    doc(`${FENCE}ts`, 'const a = 1;', FENCE, `${FENCE}js`, 'const b = 2;', FENCE, `${FENCE}json`, '{"c": 3}', FENCE),
    'a.md',
  );

  assert.deepEqual(snippets, []);
  assert.deepEqual(problems, []);
});

test('strips the fence indentation from the code and reports it as `indent`', () => {
  const {snippets} = extractSnippets(
    doc('- item', '', `  ${FENCE}ts check`, '  const a = 1;', '    const b = 2;', ' x', `  ${FENCE}`),
    'a.md',
  );

  // up to `indent` leading spaces go, deeper indentation stays, a shallower line loses what it has
  assert.deepEqual(snippets, [{file: 'a.md', line: 4, indent: 2, code: 'const a = 1;\n  const b = 2;\nx'}]);
});

test('a `ts check` line inside a block of four backticks is no marker', () => {
  const outer = '````';
  const {snippets, problems} = extractSnippets(
    doc(`${outer}md`, `${FENCE}ts check`, 'const a = 1;', FENCE, outer, `${FENCE}ts check`, 'const z = 26;', FENCE),
    'a.md',
  );

  // the inner three-backtick line does not end the outer fence; only the block after it counts
  assert.deepEqual(problems, []);
  assert.deepEqual(snippets, [{file: 'a.md', line: 7, indent: 0, code: 'const z = 26;'}]);
});

test('a marker that only looks like `ts check` is a problem with the fence line', () => {
  const {snippets, problems} = extractSnippets(
    doc(
      'prose',
      `${FENCE}js check`,
      'const a = 1;',
      FENCE,
      `${FENCE}ts check strict`,
      'const b = 2;',
      FENCE,
      `${FENCE}typescript check`,
      'const c = 3;',
      FENCE,
    ),
    'a.md',
  );

  assert.deepEqual(snippets, []);
  assert.deepEqual(
    problems.map(({file, line}) => ({file, line})),
    [
      {file: 'a.md', line: 2},
      {file: 'a.md', line: 5},
      {file: 'a.md', line: 8},
    ],
  );
  for (const problem of problems) {
    assert.match(problem.message, /unknown marker/);
    assert.match(problem.message, /only `ts check` is checked/);
  }
});

test('a marked fence that never closes is a problem with the fence line', () => {
  const {snippets, problems} = extractSnippets(doc('prose', `${FENCE}ts check`, 'const a = 1;'), 'a.md');

  assert.deepEqual(snippets, []);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].file, 'a.md');
  assert.equal(problems[0].line, 2);
});

test('tilde fences are not fences', () => {
  const {snippets, problems} = extractSnippets(doc('~~~ts check', 'const a = 1;', '~~~'), 'a.md');

  assert.deepEqual(snippets, []);
  assert.deepEqual(problems, []);
});
