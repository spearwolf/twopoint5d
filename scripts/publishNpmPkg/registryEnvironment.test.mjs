import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {registryEnvironment} from './registryEnvironment.mjs';

describe('registryEnvironment', () => {
  it('hands publishConfig.registry to npm show as npm_config_registry, replacing one set in any case', () => {
    const env = {
      PATH: '/usr/bin',
      NPM_CONFIG_REGISTRY: 'https://other.example/',
      npm_config_registry: 'https://another.example/',
      Npm_Config_Registry: 'https://third.example/',
    };

    assert.deepEqual(registryEnvironment({publishConfig: {registry: 'https://registry.example/'}}, env), {
      PATH: '/usr/bin',
      npm_config_registry: 'https://registry.example/',
    });
  });

  it('leaves the environment as it is without publishConfig.registry', () => {
    const env = {PATH: '/usr/bin', NPM_CONFIG_REGISTRY: 'https://other.example/'};

    for (const pkgJson of [{}, {publishConfig: {}}]) {
      const result = registryEnvironment(pkgJson, env);
      assert.deepEqual(result, env);
      assert.notEqual(result, env);
    }
  });

  it('does not change the environment it is given', () => {
    const env = {NPM_CONFIG_REGISTRY: 'https://other.example/'};

    registryEnvironment({publishConfig: {registry: 'https://registry.example/'}}, env);

    assert.deepEqual(env, {NPM_CONFIG_REGISTRY: 'https://other.example/'});
  });
});
