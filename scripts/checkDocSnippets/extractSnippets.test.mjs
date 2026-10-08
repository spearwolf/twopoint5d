import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
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

  // up to `indent` leading spaces go, deeper indentation stays, a shallower line loses
  // what it has
  assert.deepEqual(snippets, [{file: 'a.md', line: 4, indent: 2, code: 'const a = 1;\n  const b = 2;\nx'}]);
});

test('a `ts check` line inside a block of four backticks is no marker', () => {
  const outer = '````';
  const {snippets, problems} = extractSnippets(
    doc(`${outer}md`, `${FENCE}ts check`, 'const a = 1;', FENCE, outer, `${FENCE}ts check`, 'const z = 26;', FENCE),
    'a.md',
  );

  // the inner three-backtick line does not end the outer fence; only the block after
  // it counts
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
  const problem = /** @type {(typeof problems)[number]} */ (problems[0]);
  assert.equal(problem.file, 'a.md');
  assert.equal(problem.line, 2);
});

test('tilde fences are not fences', () => {
  const {snippets, problems} = extractSnippets(doc('~~~ts check', 'const a = 1;', '~~~'), 'a.md');

  assert.deepEqual(snippets, []);
  assert.deepEqual(problems, []);
});

test('a line whose info string holds a backtick opens no fence, so a marked block after it is found', () => {
  const {snippets, problems} = extractSnippets(
    doc(`${FENCE}inline${FENCE} prose`, '', `${FENCE}ts check`, 'const a = 1;', FENCE),
    'a.md',
  );

  assert.deepEqual(snippets, [{file: 'a.md', line: 4, indent: 0, code: 'const a = 1;'}]);
  assert.deepEqual(problems, []);
});

describe('in a CHANGELOG.md', () => {
  const changelog = doc(
    '# CHANGELOG',
    '',
    `${FENCE}ts check`,
    'const preamble = 0;',
    FENCE,
    '## [Unreleased]',
    '',
    `${FENCE}ts check`,
    'const unreleased = 1;',
    FENCE,
    '',
    `${FENCE}ts`,
    '## [not a heading, code]',
    FENCE,
    '',
    `${FENCE}ts check`,
    'const stillUnreleased = 2;',
    FENCE,
    '## [0.22.0] - 2026-09-30',
    '',
    `${FENCE}ts check`,
    'import {Removed} from "somewhere";',
    FENCE,
    `${FENCE}js check`,
    'const typo = 3;',
    FENCE,
    '## [Unreleased]',
    `${FENCE}ts check`,
    'const afterTheCut = 4;',
    FENCE,
  );

  test('keeps the blocks of the Unreleased section, a `## [` line inside a code block included', () => {
    const {snippets, problems} = extractSnippets(changelog, 'packages/twopoint5d/CHANGELOG.md');

    assert.deepEqual(problems, []);
    assert.deepEqual(
      snippets.map(({line, code}) => ({line, code})),
      [
        {line: 9, code: 'const unreleased = 1;'},
        {line: 17, code: 'const stillUnreleased = 2;'},
      ],
    );
  });

  test('skips the blocks of a released section and their markers, and nothing reopens the section after the cut', () => {
    const {snippets, problems} = extractSnippets(changelog, 'CHANGELOG.md');

    assert.equal(
      snippets.some(({code}) => code.includes('Removed') || code.includes('afterTheCut') || code.includes('preamble')),
      false,
    );
    assert.deepEqual(problems, []);
  });

  test('without an Unreleased section has no block to check', () => {
    const {snippets} = extractSnippets(
      doc('# CHANGELOG', '## [0.22.0] - 2026-09-30', `${FENCE}ts check`, 'const a = 1;', FENCE),
      'CHANGELOG.md',
    );

    assert.deepEqual(snippets, []);
  });

  test('another Markdown file keeps every block, version headings or not', () => {
    const {snippets} = extractSnippets(changelog, 'docs/NOTES.md');

    assert.equal(snippets.length, 5);
  });
});
