import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, it} from 'node:test';
import {releaseFiles} from './releaseFiles.mjs';

describe('releaseFiles', () => {
  let dir;
  let ws;
  let project;
  let dist;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'releaseFiles-'));
    ws = path.join(dir, 'workspace');
    project = path.join(dir, 'project');
    dist = path.join(dir, 'dist');
    for (const d of [ws, project, dist]) {
      fs.mkdirSync(d);
    }
  });

  afterEach(() => {
    fs.rmSync(dir, {recursive: true, force: true});
  });

  function touch(...segments) {
    fs.writeFileSync(path.join(...segments), '');
  }

  function files() {
    return releaseFiles({workspaceRoot: ws, projectRoot: project, packageRoot: dist});
  }

  it('a release carries LICENSE, CHANGELOG.md and README.md', () => {
    touch(ws, 'LICENSE');
    touch(project, 'CHANGELOG.md');
    touch(project, 'README.md');
    assert.deepEqual(files(), [
      {src: `${ws}/LICENSE`, dst: `${dist}/LICENSE`},
      {src: `${project}/CHANGELOG.md`, dst: `${dist}/CHANGELOG.md`},
      {src: `${project}/README.md`, dst: `${dist}/README.md`},
    ]);
  });

  it('README-pkg.md ships as README.md when the project has one', () => {
    touch(ws, 'LICENSE');
    touch(project, 'CHANGELOG.md');
    touch(project, 'README.md');
    touch(project, 'README-pkg.md');
    assert.deepEqual(files()[2], {src: `${project}/README-pkg.md`, dst: `${dist}/README.md`});
  });

  it('a workspace .npmrc goes along, first', () => {
    touch(ws, '.npmrc');
    touch(ws, 'LICENSE');
    touch(project, 'CHANGELOG.md');
    touch(project, 'README.md');
    assert.deepEqual(files(), [
      {src: `${ws}/.npmrc`, dst: `${dist}/.npmrc`},
      {src: `${ws}/LICENSE`, dst: `${dist}/LICENSE`},
      {src: `${project}/CHANGELOG.md`, dst: `${dist}/CHANGELOG.md`},
      {src: `${project}/README.md`, dst: `${dist}/README.md`},
    ]);
  });

  it('a missing CHANGELOG.md is named', () => {
    touch(ws, 'LICENSE');
    touch(project, 'README.md');
    assert.throws(files, {message: /^\S*\/project\/CHANGELOG\.md does not exist$/});
  });

  it('a missing README is named by the README.md it falls back to', () => {
    touch(ws, 'LICENSE');
    touch(project, 'CHANGELOG.md');
    assert.throws(files, {message: /^\S*\/project\/README\.md does not exist$/});
  });

  it('every missing file is named in one message', () => {
    assert.throws(files, {
      message: `${ws}/LICENSE, ${project}/CHANGELOG.md, ${project}/README.md do not exist`,
    });
  });
});
