import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {findRuntimeDependencies} from './findRuntimeDependencies.mjs';

describe('findRuntimeDependencies', () => {
  it('names every entry of dependencies and optionalDependencies, section by section', () => {
    const manifest = {dependencies: {a: '^1.0.0'}, optionalDependencies: {b: '^2.0.0'}};

    assert.deepEqual(findRuntimeDependencies(manifest), [
      {section: 'dependencies', name: 'a'},
      {section: 'optionalDependencies', name: 'b'},
    ]);
  });

  it('leaves peerDependencies and devDependencies out', () => {
    const manifest = {peerDependencies: {three: '~0.185.1'}, devDependencies: {vitest: '^5.0.1'}};

    assert.deepEqual(findRuntimeDependencies(manifest), []);
  });

  it('passes a manifest without these sections, and one with empty sections', () => {
    assert.deepEqual(findRuntimeDependencies({}), []);
    assert.deepEqual(findRuntimeDependencies({dependencies: {}, optionalDependencies: {}}), []);
  });

  it('names a package listed in both sections twice, once per section', () => {
    const manifest = {dependencies: {shared: '^1.0.0'}, optionalDependencies: {shared: '^1.0.0'}};

    assert.deepEqual(findRuntimeDependencies(manifest), [
      {section: 'dependencies', name: 'shared'},
      {section: 'optionalDependencies', name: 'shared'},
    ]);
  });

  it('names every entry of bundleDependencies and bundledDependencies', () => {
    const manifest = {
      dependencies: {a: '^1.0.0'},
      optionalDependencies: {b: '^2.0.0'},
      bundleDependencies: ['c', 'd'],
      bundledDependencies: ['e'],
    };

    assert.deepEqual(findRuntimeDependencies(manifest), [
      {section: 'dependencies', name: 'a'},
      {section: 'optionalDependencies', name: 'b'},
      {section: 'bundleDependencies', name: 'c'},
      {section: 'bundleDependencies', name: 'd'},
      {section: 'bundledDependencies', name: 'e'},
    ]);
  });

  it('passes bundleDependencies: true, which bundles nothing but the dependencies named already', () => {
    assert.deepEqual(findRuntimeDependencies({bundleDependencies: true}), []);
    assert.deepEqual(findRuntimeDependencies({bundledDependencies: false}), []);
  });
});
