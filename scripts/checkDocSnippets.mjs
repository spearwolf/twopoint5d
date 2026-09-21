// The code blocks of the Markdown docs that stand on their own must keep compiling.
// A plain `ts` block is an excerpt and nothing checks it; a block that imports everything it
// uses and declares everything it names carries `ts check` as its info string, and this script
// compiles it as a module of its own against the built library under the root tsconfig.
//
// The blocks import `@spearwolf/twopoint5d` like a consumer, so they resolve from the working
// directory: the Nx target `twopoint5d-testing:typecheck` runs this from `packages/twopoint5d-testing`,
// the package that depends on the built library, `three`, `@spearwolf/eventize` and `@spearwolf/signalize`.
//
//   node scripts/checkDocSnippets.mjs [file.md …]   (default: every tracked *.md of the repository)
//
// Exit 0: no errors. 1: a type error, or a marker that is not exactly `ts check`. 2: git or the tsconfig is unreadable.

import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {compileSnippets} from './checkDocSnippets/compileSnippets.mjs';
import {extractSnippets} from './checkDocSnippets/extractSnippets.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const anchorDir = process.cwd();
const tsconfigPath = path.join(repoRoot, 'tsconfig.json');

const display = (file) => {
  const relative = path.relative(repoRoot, file);
  return relative.startsWith('..') || path.isAbsolute(relative) ? file : relative;
};

let files;
let diagnostics;
let snippets = [];
let problems = [];

try {
  // tracked files only: untracked notes must not decide whether the gate passes
  files =
    process.argv.length > 2
      ? process.argv.slice(2)
      : execFileSync('git', ['ls-files', '-z', '--', '*.md'], {cwd: repoRoot, encoding: 'utf8'})
          .split('\0')
          .filter(Boolean)
          .map((file) => path.join(repoRoot, file));

  for (const file of files) {
    const extracted = extractSnippets(fs.readFileSync(file, 'utf8'), file);
    snippets.push(...extracted.snippets);
    problems.push(...extracted.problems);
  }

  diagnostics = compileSnippets({snippets, anchorDir, tsconfigPath});
} catch (err) {
  console.error(`checkDocSnippets: ${err.message}`);
  process.exit(2);
}

for (const {file, line, message} of problems) {
  console.error(`${display(file)}:${line}:1 - error: ${message}`);
}

for (const {file, line, column, code, message} of diagnostics) {
  const location = file == null ? '' : `${display(file)}:${line}:${column} - `;
  console.error(`${location}error TS${code}: ${message}`);
}

const errors = problems.length + diagnostics.length;
const fileCount = new Set(snippets.map((snippet) => snippet.file)).size;
const summary = `${snippets.length} blocks marked "ts check" in ${fileCount} files, ${errors} errors`;

if (errors === 0) {
  console.log(summary);
} else {
  console.error(summary);
  process.exit(1);
}
