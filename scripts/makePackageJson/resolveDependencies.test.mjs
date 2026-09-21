import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {after, before, describe, it} from 'node:test';
import {resolveDependencies} from './resolveDependencies.mjs';

describe('resolveDependencies', () => {
  let dir;

  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'makePackageJson-'));
    writeManifest('other', {name: '@scope/other', version: '2.3.4-dev'});
    writeManifest('self', {name: '@scope/self', version: '9.9.9'});
    writeManifest('noversion', {name: '@scope/noversion'});
    writeManifest('badversion', {name: '@scope/badversion', version: 'banana'});
    fs.mkdirSync(path.join(dir, 'packages', 'broken'), {recursive: true});
    fs.writeFileSync(path.join(dir, 'packages', 'broken', 'package.json'), '{');
  });

  after(() => {
    fs.rmSync(dir, {recursive: true, force: true});
  });

  function writeManifest(packageDir, manifest) {
    fs.mkdirSync(path.join(dir, 'packages', packageDir), {recursive: true});
    fs.writeFileSync(path.join(dir, 'packages', packageDir, 'package.json'), JSON.stringify(manifest));
  }

  function resolve(section, pnpmWorkspaceConfig, sharedDependencies = {}) {
    resolveDependencies(section, {
      workspaceRoot: dir,
      pnpmWorkspaceConfig,
      sharedDependencies,
      referencedFrom: '@scope/self',
    });
    return section;
  }

  it('a workspace:* dependency takes the version of the package it names', () => {
    assert.deepEqual(resolve({'@scope/other': 'workspace:*'}, {}), {'@scope/other': '^2.3.4'});
  });

  it('a workspace:~ dependency keeps its operator', () => {
    assert.deepEqual(resolve({'@scope/other': 'workspace:~'}, {}), {'@scope/other': '~2.3.4'});
  });

  it('a workspace:^ dependency keeps its operator', () => {
    assert.deepEqual(resolve({'@scope/other': 'workspace:^'}, {}), {'@scope/other': '^2.3.4'});
  });

  it('a workspace: dependency with a range ships that range', () => {
    assert.deepEqual(resolve({'@scope/other': 'workspace:^2.0.0'}, {}), {'@scope/other': '^2.0.0'});
  });

  it('a workspace: dependency with a range ships that range even when no package carries the name', () => {
    const section = resolve({'@scope/missing': 'workspace:^2.0.0'}, {}, {'@scope/missing': '^9.9.9'});
    assert.deepEqual(section, {'@scope/missing': '^2.0.0'});
  });

  it('a workspace: range ships trimmed and as written', () => {
    assert.deepEqual(resolve({'@scope/other': 'workspace: ^2.0.0 '}, {}), {'@scope/other': '^2.0.0'});
    // validRange would normalize this to `>=1.0.0 <2.0.0-0||>=2.5.0`
    assert.deepEqual(resolve({'@scope/other': 'workspace:1.x || >=2.5.0'}, {}), {'@scope/other': '1.x || >=2.5.0'});
  });

  it('a workspace: operator with whitespace around it takes the version of the package it names', () => {
    assert.deepEqual(resolve({'@scope/other': 'workspace: * '}, {}), {'@scope/other': '^2.3.4'});
    assert.deepEqual(resolve({'@scope/other': 'workspace: ~'}, {}), {'@scope/other': '~2.3.4'});
  });

  it('a workspace: specifier whose range is no version range stays as it is', () => {
    assert.deepEqual(resolve({'@scope/other': 'workspace:../other'}, {}), {'@scope/other': 'workspace:../other'});
    assert.deepEqual(resolve({'@scope/other': 'workspace:banana'}, {}), {'@scope/other': 'workspace:banana'});
    assert.deepEqual(resolve({'@scope/other': 'workspace:'}, {}), {'@scope/other': 'workspace:'});
    assert.deepEqual(resolve({'@scope/other': 'workspace: '}, {}), {'@scope/other': 'workspace: '});
  });

  it('a workspace: dependency whose package.json is not JSON stays as it is', () => {
    assert.deepEqual(resolve({'@scope/broken': 'workspace:*'}, {}), {'@scope/broken': 'workspace:*'});
    assert.deepEqual(resolve({'@scope/broken': 'workspace:^'}, {}), {'@scope/broken': 'workspace:^'});
  });

  it('a workspace: dependency whose package has no version semver can read stays as it is', () => {
    for (const name of ['@scope/noversion', '@scope/badversion']) {
      for (const specifier of ['workspace:*', 'workspace:~']) {
        assert.deepEqual(resolve({[name]: specifier}, {}), {[name]: specifier});
      }
    }
  });

  it('an aliased workspace: dependency stays as it is', () => {
    assert.deepEqual(resolve({bar: 'workspace:@scope/other@*'}, {}), {bar: 'workspace:@scope/other@*'});
  });

  it('catalog: and catalog:default resolve from the default catalog', () => {
    const section = resolve(
      {three: 'catalog:', '@types/three': 'catalog:default'},
      {catalog: {three: '~1.0.0', '@types/three': '~1.0.1'}},
    );
    assert.deepEqual(section, {three: '~1.0.0', '@types/three': '~1.0.1'});
  });

  it('a default catalog declared under catalogs.default resolves', () => {
    assert.deepEqual(resolve({three: 'catalog:'}, {catalogs: {default: {three: '~1.0.0'}}}), {three: '~1.0.0'});
  });

  it('catalog:<name> resolves from the named catalog', () => {
    const config = {catalog: {three: '~1.0.0'}, catalogs: {legacy: {three: '~0.9.0'}}};
    assert.deepEqual(resolve({three: 'catalog:legacy'}, config), {three: '~0.9.0'});
  });

  it('a catalog: dependency its catalog does not list stays as it is', () => {
    const section = resolve({three: 'catalog:', extra: 'catalog:missing'}, {catalog: {}}, {three: '^0.1.0', extra: '^0.2.0'});
    assert.deepEqual(section, {three: 'catalog:', extra: 'catalog:missing'});
  });

  it('a * dependency nothing resolves stays *', () => {
    assert.deepEqual(resolve({unknown: '*'}, {}), {unknown: '*'});
  });
});
