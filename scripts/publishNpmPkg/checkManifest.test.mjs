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

  it('a publishConfig.registry that is no http or https URL is named', () => {
    for (const registry of [42, '', 'registry.npmjs.org', 'file:///tmp/registry']) {
      assert.throws(() => checkManifest({name: 'x', version: '1.0.0', publishConfig: {registry}}), {
        message: `publishConfig.registry is ${JSON.stringify(registry)}, which is no http or https URL`,
      });
    }
  });

  it('a manifest with an https publishConfig.registry, or without publishConfig, passes', () => {
    assert.doesNotThrow(() =>
      checkManifest({name: 'x', version: '1.0.0', publishConfig: {registry: 'https://registry.npmjs.org/'}}),
    );
    assert.doesNotThrow(() => checkManifest({name: 'x', version: '1.0.0', publishConfig: {access: 'public'}}));
    assert.doesNotThrow(() => checkManifest({name: 'x', version: '1.0.0'}));
  });

  it('a manifest that still carries a catalog:, workspace: or bare * specifier is refused, naming each', () => {
    const manifest = {
      name: 'x',
      version: '1.0.0',
      peerDependencies: {three: 'catalog:', a: 'workspace:^'},
      dependencies: {b: '*'},
    };

    assert.throws(() => checkManifest(manifest), {
      message:
        /^dependencies\.b is "\*", which lets in any version.*; peerDependencies\.three is "catalog:", which resolves to no version range; peerDependencies\.a is "workspace:\^", which resolves to no version range — publish the dist\/ that makePackageJson\.mjs writes$/,
    });
  });
});
