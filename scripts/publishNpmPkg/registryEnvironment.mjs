/**
 * The environment `npm show` runs in. `npm publish` takes `publishConfig.registry` over every
 * config file and environment variable, `npm show` reads no `publishConfig` at all; handed in as
 * `npm_config_registry`, the version check asks the registry the publish goes to, and the value
 * from the manifest stands on no command line.
 * @param {{publishConfig?: {registry?: string}}} pkgJson checked by `checkManifest()`
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {NodeJS.ProcessEnv}
 */
export function registryEnvironment(pkgJson, env = process.env) {
  const registry = pkgJson.publishConfig?.registry;
  if (registry === undefined) {
    return {...env};
  }
  // npm reads NPM_CONFIG_REGISTRY and npm_config_registry alike, and which one wins depends on
  // their order, so none of them may stay next to the value from the manifest
  const kept = Object.entries(env).filter(([key]) => key.toLowerCase() !== 'npm_config_registry');
  return {...Object.fromEntries(kept), npm_config_registry: registry};
}
