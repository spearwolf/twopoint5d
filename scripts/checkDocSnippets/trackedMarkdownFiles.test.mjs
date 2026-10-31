import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, it} from 'node:test';
import {trackedMarkdownFiles} from './trackedMarkdownFiles.mjs';

let repo;

const git = (args, input) => execFileSync('git', args, {cwd: repo, encoding: 'utf8', input});
const write = (file, text = '# text\n') => {
  fs.mkdirSync(path.dirname(path.join(repo, file)), {recursive: true});
  fs.writeFileSync(path.join(repo, file), text);
};

beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'tracked-markdown-'));
  git(['init', '--quiet']);
});

afterEach(() => {
  fs.rmSync(repo, {recursive: true, force: true});
});

describe('trackedMarkdownFiles()', () => {
  it('leaves out a tracked file the working tree no longer holds', () => {
    for (const file of ['a.md', 'docs/b.md', 'with space.md', 'gone.md', 'notes.txt']) write(file);
    git(['add', '--', '.']);
    fs.rmSync(path.join(repo, 'gone.md'));
    write('untracked.md');

    assert.deepEqual(trackedMarkdownFiles(repo).sort(), ['a.md', 'docs/b.md', 'with space.md']);
  });

  it('names a file once while a merge conflict holds it in three stages', () => {
    write('c.md');
    const sha = git(['hash-object', '-w', 'c.md']).trim();
    git(['update-index', '--index-info'], [1, 2, 3].map((stage) => `100644 ${sha} ${stage}\tc.md\n`).join(''));

    assert.deepEqual(trackedMarkdownFiles(repo), ['c.md']);
  });
});
