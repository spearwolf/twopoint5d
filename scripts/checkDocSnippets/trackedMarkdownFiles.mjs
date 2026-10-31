import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * The Markdown files git tracks under `repoRoot` that the working tree holds, relative to it,
 * each once. A file deleted or moved without `git rm`/`git mv` stays in the index until the next
 * commit and has no blocks to check; a merge conflict lists a path once per stage.
 *
 * @param {string} repoRoot
 * @returns {string[]}
 */
export function trackedMarkdownFiles(repoRoot) {
  const listed = execFileSync('git', ['ls-files', '-z', '--', '*.md'], {cwd: repoRoot, encoding: 'utf8'})
    .split('\0')
    .filter(Boolean);
  return [...new Set(listed)].filter((file) => fs.existsSync(path.join(repoRoot, file)));
}
