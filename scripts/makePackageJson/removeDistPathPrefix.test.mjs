import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {removeDistPathPrefix} from './removeDistPathPrefix.mjs';

describe('removeDistPathPrefix', () => {
  it('removes a leading dist/ and ./dist/ from main, module, types and every exports target', () => {
    const manifest = {
      exports: {'.': {types: './dist/lib/index.d.ts', import: './dist/lib/index.js'}},
      main: 'dist/lib/index.js',
      module: 'dist/lib/index.js',
      types: 'dist/lib/index.d.ts',
    };

    assert.deepEqual(removeDistPathPrefix(manifest), {
      exports: {'.': {types: './lib/index.d.ts', import: './lib/index.js'}},
      main: 'lib/index.js',
      module: 'lib/index.js',
      types: 'lib/index.d.ts',
    });
  });

  it('rewrites every path of a fallback array', () => {
    assert.deepEqual(removeDistPathPrefix({exports: {'.': ['./dist/a.js', './dist/b.js']}}), {
      exports: {'.': ['./a.js', './b.js']},
    });
  });

  it('leaves a path without dist/ alone', () => {
    assert.deepEqual(removeDistPathPrefix({exports: {'./package.json': './package.json'}}), {
      exports: {'./package.json': './package.json'},
    });
  });

  it('keeps a dist/ that does not lead the path', () => {
    assert.deepEqual(removeDistPathPrefix({main: 'lib/dist/index.js', exports: {'.': './lib/dist/index.js'}}), {
      main: 'lib/dist/index.js',
      exports: {'.': './lib/dist/index.js'},
    });
  });

  it('takes a manifest without exports', () => {
    const result = removeDistPathPrefix({main: 'dist/index.js'});

    assert.deepEqual(result, {main: 'index.js'});
    assert.equal('exports' in result, false);
  });

  it('keeps a null target in exports', () => {
    assert.deepEqual(removeDistPathPrefix({exports: {'.': './dist/index.js', './internal/*': null}}), {
      exports: {'.': './index.js', './internal/*': null},
    });
  });

  it('rewrites exports given as a single path', () => {
    assert.deepEqual(removeDistPathPrefix({exports: './dist/index.js'}), {exports: './index.js'});
  });
});
