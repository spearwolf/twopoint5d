import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {extractSnippets} from './extractSnippets.mjs';

const FENCE = '```';
const TILDES = '~~~';

// a markdown document built from lines, so the fences do not fight the template literal
const doc = (...lines) => lines.join('\n');

test('finds a block marked `ts check`: line is the first code line, code carries no fences', () => {
  const {snippets, problems} = extractSnippets(
    doc('# Title', '', 'some prose', `${FENCE}ts check`, 'const a = 1;', 'const b = 2;', FENCE, 'after'),
    'a.md',
  );

  assert.deepEqual(problems, []);
  assert.deepEqual(snippets, [{file: 'a.md', line: 5, code: 'const a = 1;\nconst b = 2;', offsets: [0, 0]}]);
});

test('ignores blocks whose info string is `ts`, `js` or `json`', () => {
  const {snippets, problems} = extractSnippets(
    doc(`${FENCE}ts`, 'const a = 1;', FENCE, `${FENCE}js`, 'const b = 2;', FENCE, `${FENCE}json`, '{"c": 3}', FENCE),
    'a.md',
  );

  assert.deepEqual(snippets, []);
  assert.deepEqual(problems, []);
});

test('strips the fence indentation from the code and reports per line what it took off', () => {
  const {snippets} = extractSnippets(
    doc('- item', '', `  ${FENCE}ts check`, '  const a = 1;', '    const b = 2;', ' x', `  ${FENCE}`),
    'a.md',
  );

  // up to the indentation of the fence goes, deeper indentation stays, a shallower line loses
  // what it has
  assert.deepEqual(snippets, [{file: 'a.md', line: 4, code: 'const a = 1;\n  const b = 2;\nx', offsets: [2, 2, 1]}]);
});

test('a fence indented four spaces at the top level opens no block: the line is code of an indented block', () => {
  const {snippets, problems} = extractSnippets(
    doc(
      'Write a fence like this:',
      '',
      `    ${FENCE}ts check`,
      '',
      'and close it.',
      '',
      `${FENCE}ts check`,
      'const b = 1;',
      FENCE,
    ),
    'a.md',
  );

  assert.deepEqual(snippets, [{file: 'a.md', line: 8, code: 'const b = 1;', offsets: [0]}]);
  assert.deepEqual(problems, []);
});

test('a tab before a fence is four columns: the line opens no block', () => {
  const {snippets, problems} = extractSnippets(doc(`\t${FENCE}ts check`, 'const a = 1;', `\t${FENCE}`), 'a.md');

  assert.deepEqual(snippets, []);
  assert.deepEqual(problems, []);
});

test('a line indented four spaces inside a block is code, not its closing fence', () => {
  const {snippets} = extractSnippets(
    doc(`${FENCE}ts check`, '// a fence in a comment:', `    ${FENCE}`, 'const a = 1;', FENCE),
    'a.md',
  );

  assert.deepEqual(snippets, [
    {file: 'a.md', line: 2, code: `// a fence in a comment:\n    ${FENCE}\nconst a = 1;`, offsets: [0, 0, 0]},
  ]);
});

test('a fence indented four spaces in a nested list item opens a block', () => {
  const {snippets} = extractSnippets(
    doc('- outer', '  - inner', '', `    ${FENCE}ts check`, '    const a = 1;', `    ${FENCE}`),
    'a.md',
  );

  assert.deepEqual(snippets, [{file: 'a.md', line: 5, code: 'const a = 1;', offsets: [4]}]);
});

test('a fence of an ordered list item is measured from the content of the item', () => {
  const {snippets} = extractSnippets(doc('10. item', '', `    ${FENCE}ts check`, '    const a = 1;', `    ${FENCE}`), 'a.md');

  assert.deepEqual(snippets, [{file: 'a.md', line: 4, code: 'const a = 1;', offsets: [4]}]);
});

test('a fence four columns past the content of its list item is code of an indented block', () => {
  const {snippets} = extractSnippets(doc('- item', '', `      ${FENCE}ts check`, '      const a = 1;', `      ${FENCE}`), 'a.md');

  assert.deepEqual(snippets, []);
});

test('a line less indented than the content of a list item ends it: a fence after it is measured from its line', () => {
  const {snippets} = extractSnippets(doc('- item', '', 'prose', '', `    ${FENCE}ts check`, 'x', `    ${FENCE}`), 'a.md');

  assert.deepEqual(snippets, []);
});

test('a tab after a list marker counts to the next multiple of four: a fence at the content of the item opens a block', () => {
  const expected = [{file: 'a.md', line: 4, code: 'const a = 1;', offsets: [4]}];
  const rest = ['', `    ${FENCE}ts check`, '    const a = 1;', `    ${FENCE}`];

  assert.deepEqual(extractSnippets(doc('-\titem', ...rest), 'a.md').snippets, expected);
  assert.deepEqual(extractSnippets(doc('1.\titem', ...rest), 'a.md').snippets, expected);
});

test('a list marker followed by more than four columns starts its item with indented code: the content is one column past the marker', () => {
  const {snippets} = extractSnippets(doc('-\t\tcode', '', `     ${FENCE}ts check`, '     const a = 1;', `     ${FENCE}`), 'a.md');

  assert.deepEqual(snippets, [{file: 'a.md', line: 4, code: 'const a = 1;', offsets: [5]}]);
});

test('a list item whose first line is empty after the marker has its content one column past the marker', () => {
  const {snippets} = extractSnippets(doc('-   ', `      ${FENCE}ts check`, '      const a = 1;', `      ${FENCE}`), 'a.md');

  assert.deepEqual(snippets, []);
});

test('a line of three *, - or _ is a thematic break and no list item: a fence four columns deep after it is code of an indented block', () => {
  for (const rule of ['* * *', '- - -', '___']) {
    const {snippets} = extractSnippets(doc(rule, '', `    ${FENCE}ts check`, '    const a = 1;', `    ${FENCE}`), 'a.md');

    assert.deepEqual(snippets, [], rule);
  }
});

test('a thematic break as the content of a list item leaves the item open', () => {
  const {snippets} = extractSnippets(doc('- * * *', '', `    ${FENCE}ts check`, '    const a = 1;', `    ${FENCE}`), 'a.md');

  assert.deepEqual(snippets, [{file: 'a.md', line: 4, code: 'const a = 1;', offsets: [4]}]);
});

test('a fence on the line of a list marker opens a block in the item, and the fences after it pair up', () => {
  assert.deepEqual(extractSnippets(doc(`- ${FENCE}ts check`, '  const a = 1;', `  ${FENCE}`), 'a.md').snippets, [
    {file: 'a.md', line: 2, code: 'const a = 1;', offsets: [2]},
  ]);

  assert.deepEqual(extractSnippets(doc(`1. - ${FENCE}ts check`, '     const a = 1;', `     ${FENCE}`), 'a.md').snippets, [
    {file: 'a.md', line: 2, code: 'const a = 1;', offsets: [5]},
  ]);

  assert.deepEqual(
    extractSnippets(doc(`- ${FENCE}ts`, '  x', `  ${FENCE}`, '', `${FENCE}ts check`, 'const z = 26;', FENCE), 'a.md').snippets,
    [{file: 'a.md', line: 6, code: 'const z = 26;', offsets: [0]}],
  );
});

test('a marked fence in a blockquote on the line of a list marker is a problem with its line', () => {
  const {snippets, problems} = extractSnippets(doc(`- > ${FENCE}ts check`, '  > const a = 1;', `  > ${FENCE}`), 'a.md');

  assert.deepEqual(snippets, []);
  assert.deepEqual(problems, [
    {
      file: 'a.md',
      line: 1,
      message:
        'a code block marked `ts check` inside a blockquote is not checked — only a `ts check` block outside a quote is compiled',
    },
  ]);
});

test('a tab before the code of a block counts as columns: the code loses as much as its fence is deep', () => {
  assert.deepEqual(extractSnippets(doc('- item', '', `\t${FENCE}ts check`, '\tconst a = 1;', `\t${FENCE}`), 'a.md').snippets, [
    {file: 'a.md', line: 4, code: 'const a = 1;', offsets: [1]},
  ]);

  // the tab reaches column 4, two columns go, two stay as spaces
  assert.deepEqual(extractSnippets(doc('- item', '', `  ${FENCE}ts check`, '\tconst a = 1;', `  ${FENCE}`), 'a.md').snippets, [
    {file: 'a.md', line: 4, code: '  const a = 1;', offsets: [-1]},
  ]);
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
  assert.deepEqual(snippets, [{file: 'a.md', line: 7, code: 'const z = 26;', offsets: [0]}]);
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

test('finds a block marked `ts check` in a tilde fence', () => {
  const {snippets, problems} = extractSnippets(doc('prose', `${TILDES}ts check`, 'const a = 1;', TILDES), 'a.md');

  assert.deepEqual(problems, []);
  assert.deepEqual(snippets, [{file: 'a.md', line: 3, code: 'const a = 1;', offsets: [0]}]);
});

test('a backtick fence line inside a tilde fence is code, and a tilde line inside a backtick fence too', () => {
  const {snippets, problems} = extractSnippets(
    doc(
      `${TILDES}md`,
      `${FENCE}ts check`,
      'const a = 1;',
      FENCE,
      TILDES,
      `${FENCE}md`,
      `${TILDES}ts check`,
      'const b = 2;',
      TILDES,
      FENCE,
      `${FENCE}ts check`,
      'const z = 26;',
      FENCE,
    ),
    'a.md',
  );

  assert.deepEqual(problems, []);
  assert.deepEqual(snippets, [{file: 'a.md', line: 12, code: 'const z = 26;', offsets: [0]}]);
});

test('a tilde fence closes only on tildes, at least as many as it opened with', () => {
  const {snippets, problems} = extractSnippets(
    doc('~~~~ts check', 'const a = 1;', TILDES, 'const b = 2;', '~~~~~', 'prose'),
    'a.md',
  );

  assert.deepEqual(problems, []);
  assert.deepEqual(snippets, [{file: 'a.md', line: 2, code: 'const a = 1;\n~~~\nconst b = 2;', offsets: [0, 0, 0]}]);
});

test('the info string of a tilde fence may hold a backtick', () => {
  const {snippets, problems} = extractSnippets(
    doc(`${TILDES}md \`x\``, `${FENCE}ts check`, 'const a = 1;', FENCE, TILDES, `${FENCE}ts check`, 'const z = 26;', FENCE),
    'a.md',
  );

  // the tilde line opens a fence all the same, so the marker inside it is an example
  assert.deepEqual(problems, []);
  assert.deepEqual(snippets, [{file: 'a.md', line: 7, code: 'const z = 26;', offsets: [0]}]);
});

test('a fence marked with `check` inside a blockquote is a problem with its line', () => {
  const {snippets, problems} = extractSnippets(
    doc(
      'prose',
      `> ${FENCE}ts check`,
      '> const a = 1;',
      `> ${FENCE}`,
      '',
      `> > ${TILDES}ts check`,
      '> > const b = 2;',
      `> > ${TILDES}`,
      '',
      `> ${FENCE}js check`,
      '> const c = 3;',
      `> ${FENCE}`,
      '',
      `> ${FENCE}ts`,
      '> const d = 4;',
      `> ${FENCE}`,
    ),
    'a.md',
  );

  assert.deepEqual(snippets, []);
  assert.deepEqual(
    problems.map(({file, line}) => ({file, line})),
    [
      {file: 'a.md', line: 2},
      {file: 'a.md', line: 6},
      {file: 'a.md', line: 10},
    ],
  );
  assert.equal(
    problems[0]?.message,
    'a code block marked `ts check` inside a blockquote is not checked — only a `ts check` block outside a quote is compiled',
  );
  assert.match(problems[2]?.message ?? '', /marked `js check` inside a blockquote/);
});

test('a line whose info string holds a backtick opens no fence, so a marked block after it is found', () => {
  const {snippets, problems} = extractSnippets(
    doc(`${FENCE}inline${FENCE} prose`, '', `${FENCE}ts check`, 'const a = 1;', FENCE),
    'a.md',
  );

  assert.deepEqual(snippets, [{file: 'a.md', line: 4, code: 'const a = 1;', offsets: [0]}]);
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

  test('a quoted marked fence in a released section is no problem', () => {
    const {snippets, problems} = extractSnippets(
      doc('## [Unreleased]', '## [0.22.0] - 2026-09-30', `> ${FENCE}ts check`, '> const a = 1;', `> ${FENCE}`),
      'CHANGELOG.md',
    );

    assert.deepEqual(snippets, []);
    assert.deepEqual(problems, []);
  });

  test('another Markdown file keeps every block, version headings or not', () => {
    const {snippets} = extractSnippets(changelog, 'docs/NOTES.md');

    assert.equal(snippets.length, 5);
  });
});
