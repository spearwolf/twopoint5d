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
