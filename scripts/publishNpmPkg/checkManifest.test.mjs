import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {checkManifest} from './checkManifest.mjs';

describe('checkManifest', () => {
  it('a manifest with a name and a version passes', () => {
    assert.doesNotThrow(() => checkManifest({name: '@scope/pkg', version: '1.0.0'}));
  });

  it('a missing or empty version is named', () => {
    for (const manifest of [{name: 'x'}, {name: 'x', version: ''}, {name: 'x', version: '  '}, {name: 'x', version: 1}]) {
      assert.throws(() => checkManifest(manifest), {message: /^the manifest has no "version"$/});
    }
  });

  it('a missing name is named', () => {
    assert.throws(() => checkManifest({version: '1.0.0'}), {message: /^the manifest has no "name"$/});
  });

  it('a manifest without either names both, and so does one that is no object', () => {
    for (const manifest of [{}, null, []]) {
      assert.throws(() => checkManifest(manifest), {message: /^the manifest has no "name" and no "version"$/});
    }
  });
});
