import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {findUnpublishableSpecifiers} from './findUnpublishableSpecifiers.mjs';

describe('findUnpublishableSpecifiers', () => {
  it('names every catalog: and workspace: specifier left in a dependency section', () => {
    const manifest = {
      dependencies: {a: 'catalog:', b: '^1.0.0'},
      peerDependencies: {c: 'workspace:*'},
      optionalDependencies: {d: 'catalog:x'},
      devDependencies: {e: 'workspace:^', f: '*'},
    };

    assert.deepEqual(findUnpublishableSpecifiers(manifest), [
      {section: 'dependencies', name: 'a', specifier: 'catalog:'},
      {section: 'peerDependencies', name: 'c', specifier: 'workspace:*'},
      {section: 'optionalDependencies', name: 'd', specifier: 'catalog:x'},
      {section: 'devDependencies', name: 'e', specifier: 'workspace:^'},
    ]);
  });

  it('passes a manifest whose specifiers are all version ranges', () => {
    const manifest = {dependencies: {a: '^1.0.0', b: '*'}, peerDependencies: {c: '~0.185.1'}};

    assert.deepEqual(findUnpublishableSpecifiers(manifest), []);
    assert.deepEqual(findUnpublishableSpecifiers({}), []);
  });
});
